#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer as createHttpServer, IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { parseConfig } from "./config.js";
import { createServer } from "./server.js";

const config = parseConfig();

if (config.transport === "http") {
  const sessions = new Map<string, { server: ReturnType<typeof createServer>; transport: StreamableHTTPServerTransport }>();

  // --- Rate limiter ---
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

  function getClientIp(req: IncomingMessage): string {
    // Support proxied requests via X-Forwarded-For, fall back to socket address
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      return forwarded.split(",")[0].trim();
    }
    return req.socket.remoteAddress || "unknown";
  }

  function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now >= entry.resetTime) {
      // First request in this window or window expired
      rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
      return false;
    }
    entry.count++;
    if (entry.count > config.rateLimit) {
      return true;
    }
    return false;
  }

  // Auto-cleanup expired entries every 60 seconds to prevent memory leak
  const rateLimitCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap) {
      if (now >= entry.resetTime) {
        rateLimitMap.delete(ip);
      }
    }
  }, 60_000);
  rateLimitCleanupInterval.unref(); // Don't prevent process exit

  const httpServer = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    // CORS headers for browser-based clients
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Rate limiting
    const clientIp = getClientIp(req);
    if (isRateLimited(clientIp)) {
      const entry = rateLimitMap.get(clientIp);
      const retryAfter = entry ? Math.ceil((entry.resetTime - Date.now()) / 1000) : 60;
      res.setHeader("Retry-After", String(retryAfter));
      res.writeHead(429);
      res.end(JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Too many requests. Please retry later." },
        id: null,
      }));
      return;
    }

    if (url.pathname !== "/mcp") {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found. Use /mcp endpoint." }));
      return;
    }

    // Parse body for POST
    if (req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const bodyText = Buffer.concat(chunks).toString("utf-8");
      let body: unknown;
      try {
        body = JSON.parse(bodyText);
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }));
        return;
      }

      // Check if this is an initialize request (new session)
      const isInit = isInitializeRequest(body);
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (isInit) {
        // Create new session
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });
        const server = createServer(config);
        await server.connect(transport);

        await transport.handleRequest(req, res, body);

        // Store session after initialization
        const newSessionId = transport.sessionId;
        if (newSessionId) {
          sessions.set(newSessionId, { server, transport });

          // Clean up session when transport closes (e.g. client disconnect)
          transport.onclose = () => {
            sessions.delete(newSessionId);
            server.close();
          };
        }
      } else if (sessionId && sessions.has(sessionId)) {
        // Existing session
        const session = sessions.get(sessionId)!;
        await session.transport.handleRequest(req, res, body);
      } else {
        res.writeHead(400);
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Bad request: no valid session. Send an initialize request first." },
          id: null,
        }));
      }
    } else if (req.method === "GET") {
      // SSE stream for notifications
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        await session.transport.handleRequest(req, res);
      } else {
        res.writeHead(400);
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Bad request: no valid session." },
          id: null,
        }));
      }
    } else if (req.method === "DELETE") {
      // Session termination
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        await session.transport.handleRequest(req, res);
        session.transport.close();
        await session.server.close();
        sessions.delete(sessionId);
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Session not found." },
          id: null,
        }));
      }
    } else {
      res.writeHead(405);
      res.end(JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed." },
        id: null,
      }));
    }
  });

  httpServer.listen(config.port, () => {
    console.error(`Portainer MCP server (Streamable HTTP) listening on port ${config.port}`);
    console.error(`Endpoint: http://localhost:${config.port}/mcp`);
  });

  process.on("SIGINT", () => {
    console.error("Shutting down...");
    clearInterval(rateLimitCleanupInterval);
    for (const [, session] of sessions) {
      session.transport.close();
      session.server.close();
    }
    httpServer.close();
    process.exit(0);
  });
} else {
  // Default: stdio transport
  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function isInitializeRequest(body: unknown): boolean {
  if (typeof body === "object" && body !== null && "method" in body) {
    return (body as { method: string }).method === "initialize";
  }
  // Could be a batch
  if (Array.isArray(body)) {
    return body.some(msg => typeof msg === "object" && msg !== null && "method" in msg && msg.method === "initialize");
  }
  return false;
}
