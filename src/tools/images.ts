import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PortainerClient } from "../client.js";
import { jsonResponse, errorResponse } from "../utils/response.js";
import { paginatedResponse } from "../utils/response.js";
import { summarizeImage, summarizeImageInspect } from "../utils/filters.js";

export function registerImageTools(server: McpServer, client: PortainerClient, readOnly: boolean): void {
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
      const result = await client.get(client.dockerPath(args.endpointId, "/images/json"), query);
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
      const result = await client.get(client.dockerPath(args.endpointId, `/images/${args.id}/json`));
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
      const result = await client.get(client.dockerPath(args.endpointId, `/images/${args.id}/history`));
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
      const result = await client.get(client.dockerPath(args.endpointId, "/images/search"), query);
      return jsonResponse(result);
    } catch (e) {
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
        const result = await client.post(client.dockerPath(args.endpointId, "/images/create"), undefined, query);
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
        const result = await client.delete(client.dockerPath(args.endpointId, `/images/${args.id}`), query);
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
        await client.post(client.dockerPath(args.endpointId, `/images/${args.id}/tag`), undefined, query);
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
        const result = await client.post(client.dockerPath(args.endpointId, "/images/prune"), undefined, query);
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });
  }
}
