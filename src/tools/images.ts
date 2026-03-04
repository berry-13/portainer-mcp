import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ClientAccessor } from "../client.js";
import { jsonResponse, errorResponse } from "../utils/response.js";
import { paginatedResponse } from "../utils/response.js";
import { summarizeImage, summarizeImageInspect } from "../utils/filters.js";

export function registerImageTools(server: McpServer, client: ClientAccessor, readOnly: boolean): void {
  const eid = z.number().describe("Environment/endpoint ID");

  server.tool("list_images", "List images in an environment", {
    endpointId: eid,
    all: z.boolean().optional().describe("Show all images (default hides intermediate)"),
    limit: z.number().optional(),
    offset: z.number().optional(),
    full: z.boolean().optional().describe("Return full Docker API response (default: summary)"),
  }, async (args) => {
    try {
      const query: Record<string, string> = {};
      if (args.all) query.all = "true";
      const result = await client().get(client().dockerPath(args.endpointId, "/images/json"), query);
      const items = args.full
        ? (result as Record<string, unknown>[])
        : (result as Record<string, unknown>[]).map(summarizeImage);
      return paginatedResponse(items, args.limit, args.offset);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("inspect_image", "Inspect an image", {
    endpointId: eid,
    id: z.string().describe("Image ID or name"),
    full: z.boolean().optional().describe("Return full Docker API response (default: summary)"),
  }, async (args) => {
    try {
      const result = await client().get(client().dockerPath(args.endpointId, `/images/${args.id}/json`));
      if (!args.full) {
        return jsonResponse(summarizeImageInspect(result as Record<string, unknown>));
      }
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("image_history", "Get history of an image", {
    endpointId: eid,
    id: z.string().describe("Image ID or name"),
  }, async (args) => {
    try {
      const result = await client().get(client().dockerPath(args.endpointId, `/images/${args.id}/history`));
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("search_images", "Search Docker Hub for images", {
    endpointId: eid,
    term: z.string().describe("Search term"),
    limit: z.number().optional().describe("Max results (default 25)"),
  }, async (args) => {
    try {
      const query: Record<string, string> = { term: args.term };
      if (args.limit !== undefined) query.limit = String(args.limit);
      const result = await client().get(client().dockerPath(args.endpointId, "/images/search"), query);
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("inspect_image_security", "Get security-relevant details of an image (user, ports, capabilities)", {
    endpointId: eid,
    id: z.string().describe("Image ID or name"),
  }, async (args) => {
    try {
      const result = await client().get(client().dockerPath(args.endpointId, `/images/${args.id}/json`)) as Record<string, unknown>;
      const config = result.Config as Record<string, unknown> | undefined;
      const rootfs = result.RootFS as Record<string, unknown> | undefined;

      const security: Record<string, unknown> = {
        Id: typeof result.Id === "string" ? result.Id.slice(0, 19) : result.Id,
        RepoTags: result.RepoTags,
        Created: result.Created,
        Architecture: result.Architecture,
        Os: result.Os,
        Size: result.Size,
        User: config?.User || "(root - no user set)",
        ExposedPorts: config?.ExposedPorts || {},
        Env: config?.Env,
        Volumes: config?.Volumes || {},
        Entrypoint: config?.Entrypoint,
        Cmd: config?.Cmd,
        Labels: config?.Labels,
        LayerCount: rootfs ? (rootfs.Layers as unknown[] | undefined)?.length : undefined,
      };

      // Flag potential security concerns
      const concerns: string[] = [];
      if (!config?.User || config.User === "") {
        concerns.push("Container runs as root (no USER directive)");
      }
      const env = (config?.Env || []) as string[];
      for (const e of env) {
        const lower = e.toLowerCase();
        if (lower.includes("password") || lower.includes("secret") || lower.includes("api_key") || lower.includes("token")) {
          concerns.push(`Potentially sensitive env var: ${e.split("=")[0]}`);
        }
      }
      const ports = Object.keys((config?.ExposedPorts || {}) as Record<string, unknown>);
      const privilegedPorts = ports.filter(p => {
        const num = parseInt(p);
        return num > 0 && num < 1024;
      });
      if (privilegedPorts.length > 0) {
        concerns.push(`Exposes privileged ports: ${privilegedPorts.join(", ")}`);
      }

      security.securityConcerns = concerns.length > 0 ? concerns : ["No obvious concerns detected"];

      return jsonResponse(security);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("get_image_vulnerabilities", "Get vulnerability scan results for an image (requires Portainer with scanning enabled)", {
    endpointId: eid,
    id: z.string().describe("Image ID or name (must be the full image name with tag)"),
  }, async (args) => {
    try {
      // Try Portainer's vulnerability endpoint
      const result = await client().get(`/api/endpoints/${args.endpointId}/docker/images/${encodeURIComponent(args.id)}/vulnerabilities`);
      return jsonResponse(result);
    } catch (e) {
      // If the endpoint doesn't exist, provide a helpful message
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("404") || msg.includes("Not Found")) {
        return jsonResponse({
          available: false,
          message: "Vulnerability scanning is not available. This requires Portainer Business Edition with image scanning enabled, or an external scanner integration.",
          suggestion: "Use inspect_image_security for basic security analysis of the image configuration.",
        });
      }
      return errorResponse(e);
    }
  });

  if (!readOnly) {
    server.tool("pull_image", "Pull an image from a registry", {
      endpointId: eid,
      fromImage: z.string().describe("Image name to pull"),
      tag: z.string().optional().describe("Tag to pull (default 'latest')"),
    }, async (args) => {
      try {
        const query: Record<string, string> = { fromImage: args.fromImage };
        if (args.tag) query.tag = args.tag;
        const result = await client().post(client().dockerPath(args.endpointId, "/images/create"), undefined, query);
        return jsonResponse({ success: true, message: `Pulled ${args.fromImage}:${args.tag || "latest"}` });
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("remove_image", "Remove an image", {
      endpointId: eid,
      id: z.string().describe("Image ID or name"),
      force: z.boolean().optional().describe("Force removal"),
      noprune: z.boolean().optional().describe("Do not delete untagged parents"),
    }, async (args) => {
      try {
        const query: Record<string, string> = {};
        if (args.force) query.force = "true";
        if (args.noprune) query.noprune = "true";
        const result = await client().delete(client().dockerPath(args.endpointId, `/images/${args.id}`), query);
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("tag_image", "Tag an image", {
      endpointId: eid,
      id: z.string().describe("Image ID or name"),
      repo: z.string().describe("Repository name"),
      tag: z.string().optional().describe("Tag name"),
    }, async (args) => {
      try {
        const query: Record<string, string> = { repo: args.repo };
        if (args.tag) query.tag = args.tag;
        await client().post(client().dockerPath(args.endpointId, `/images/${args.id}/tag`), undefined, query);
        return jsonResponse({ success: true });
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("prune_images", "Delete unused images", {
      endpointId: eid,
      dangling: z.boolean().optional().describe("Only prune dangling images (default true)"),
    }, async (args) => {
      try {
        const query: Record<string, string> = {};
        if (args.dangling !== undefined) {
          query.filters = JSON.stringify({ dangling: [String(args.dangling)] });
        }
        const result = await client().post(client().dockerPath(args.endpointId, "/images/prune"), undefined, query);
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });
  }
}
