import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ClientAccessor } from "../client.js";
import { jsonResponse, errorResponse } from "../utils/response.js";

export function registerSystemTools(server: McpServer, client: ClientAccessor, readOnly: boolean): void {
  server.tool("get_status", "Get Portainer system status", {}, async () => {
    try {
      const result = await client().get("/api/system/status");
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("get_settings", "Get Portainer settings", {}, async () => {
    try {
      const result = await client().get("/api/settings");
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("health_check", "Check Portainer health and environment connectivity", {}, async () => {
    try {
      const health: Record<string, unknown> = {};

      // Check Portainer status
      try {
        const status = await client().get("/api/system/status");
        health.portainer = { status: "healthy", details: status };
      } catch (e) {
        health.portainer = { status: "unhealthy", error: e instanceof Error ? e.message : String(e) };
      }

      // Check environments
      try {
        const endpoints = await client().get("/api/endpoints") as Array<Record<string, unknown>>;
        const envResults: Record<string, unknown>[] = [];
        for (const ep of endpoints) {
          const envHealth: Record<string, unknown> = {
            id: ep.Id,
            name: ep.Name,
            type: ep.Type,
            status: ep.Status === 1 ? "up" : "down",
          };
          // Try Docker ping for Docker environments
          if (ep.Type === 1 || ep.Type === 2) {
            try {
              await client().get(client().dockerPath(ep.Id as number, "/_ping"));
              envHealth.docker = "reachable";
            } catch {
              envHealth.docker = "unreachable";
            }
          }
          envResults.push(envHealth);
        }
        health.environments = envResults;
      } catch (e) {
        health.environments = { error: e instanceof Error ? e.message : String(e) };
      }

      return jsonResponse(health);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("get_events", "Get Docker events from an environment (bounded time range)", {
    endpointId: z.number().describe("Environment/endpoint ID"),
    since: z.string().optional().describe("Show events since timestamp (Unix timestamp or RFC3339, default: 5 minutes ago)"),
    until: z.string().optional().describe("Show events until timestamp (Unix timestamp or RFC3339, default: now)"),
    type: z.enum(["container", "image", "volume", "network", "daemon", "plugin", "node", "service", "secret", "config"]).optional().describe("Filter by event type"),
    limit: z.number().optional().describe("Max events to return (default 100)"),
  }, async (args) => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const query: Record<string, string> = {
        since: args.since || String(now - 300),
        until: args.until || String(now),
      };
      if (args.type) {
        query.filters = JSON.stringify({ type: [args.type] });
      }
      const result = await client().get(client().dockerPath(args.endpointId, "/events"), query);
      // Events API returns newline-delimited JSON
      const text = String(result);
      if (!text.trim()) {
        return jsonResponse({ events: [], total: 0 });
      }
      const events = text.trim().split("\n").map(line => {
        try { return JSON.parse(line); } catch { return { raw: line }; }
      });
      const limited = events.slice(0, args.limit || 100);
      return jsonResponse({ events: limited, total: events.length });
    } catch (e) {
      return errorResponse(e);
    }
  });
}
