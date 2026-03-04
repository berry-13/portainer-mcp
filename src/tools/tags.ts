import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PortainerClient } from "../client.js";
import { jsonResponse, errorResponse, paginatedResponse } from "../utils/response.js";

export function registerTagTools(server: McpServer, client: PortainerClient, readOnly: boolean): void {
  server.tool("list_tags", "List all tags", {
    limit: z.number().optional().describe("Max items to return"),
    offset: z.number().optional().describe("Items to skip"),
  }, async (args) => {
    try {
      const result = await client.get("/api/tags") as unknown[];
      return paginatedResponse(result, args.limit, args.offset);
    } catch (e) {
      return errorResponse(e);
    }
  });

  if (!readOnly) {
    server.tool("create_tag", "Create a new tag", {
      name: z.string().describe("Tag name"),
    }, async (args) => {
      try {
        const result = await client.post("/api/tags", { Name: args.name });
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("delete_tag", "Delete a tag", {
      id: z.number().describe("Tag ID"),
    }, async (args) => {
      try {
        await client.delete(`/api/tags/${args.id}`);
        return jsonResponse({ success: true });
      } catch (e) {
        return errorResponse(e);
      }
    });
  }
}
