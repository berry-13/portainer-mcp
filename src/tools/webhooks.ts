import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ClientAccessor } from "../client.js";
import { jsonResponse, errorResponse, paginatedResponse } from "../utils/response.js";

export function registerWebhookTools(server: McpServer, client: ClientAccessor, readOnly: boolean): void {
  server.tool("list_webhooks", "List all webhooks", {
    limit: z.number().optional().describe("Max items to return"),
    offset: z.number().optional().describe("Items to skip"),
  }, async (args) => {
    try {
      const result = await client().get("/api/webhooks") as unknown[];
      return paginatedResponse(result, args.limit, args.offset);
    } catch (e) {
      return errorResponse(e);
    }
  });

  if (!readOnly) {
    server.tool("create_webhook", "Create a webhook for a resource", {
      resourceId: z.string().describe("Resource ID (e.g. service ID)"),
      endpointId: z.number().describe("Environment/endpoint ID"),
      webhookType: z.number().describe("Webhook type (1=service)"),
    }, async (args) => {
      try {
        const result = await client().post("/api/webhooks", {
          ResourceID: args.resourceId,
          EndpointID: args.endpointId,
          WebhookType: args.webhookType,
        });
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("delete_webhook", "Delete a webhook", {
      id: z.number().describe("Webhook ID"),
    }, async (args) => {
      try {
        await client().delete(`/api/webhooks/${args.id}`);
        return jsonResponse({ success: true });
      } catch (e) {
        return errorResponse(e);
      }
    });
  }
}
