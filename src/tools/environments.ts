import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ClientAccessor } from "../client.js";
import { jsonResponse, errorResponse, paginatedResponse } from "../utils/response.js";

export function registerEnvironmentTools(server: McpServer, client: ClientAccessor, readOnly: boolean): void {
  server.tool("list_environments", "List all Portainer environments/endpoints", {
    limit: z.number().optional().describe("Max items to return"),
    offset: z.number().optional().describe("Items to skip"),
  }, async (args) => {
    try {
      const result = await client().get("/api/endpoints") as unknown[];
      return paginatedResponse(result, args.limit, args.offset);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("get_environment", "Get details of a specific environment", {
    id: z.number().describe("Environment/endpoint ID"),
  }, async (args) => {
    try {
      const result = await client().get(`/api/endpoints/${args.id}`);
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });

  if (!readOnly) {
    server.tool("create_environment", "Create a new environment/endpoint", {
      name: z.string().describe("Environment name"),
      endpointCreationType: z.number().describe("Creation type (1=local, 2=agent, 4=edge agent, 5=edge agent async)"),
      url: z.string().optional().describe("URL or IP of the environment"),
      publicURL: z.string().optional().describe("Public URL for the environment"),
      groupId: z.number().optional().describe("Group ID"),
      tagIds: z.array(z.number()).optional().describe("Tag IDs to assign"),
    }, async (args) => {
      try {
        const body: Record<string, unknown> = {
          Name: args.name,
          EndpointCreationType: args.endpointCreationType,
        };
        if (args.url) body.URL = args.url;
        if (args.publicURL) body.PublicURL = args.publicURL;
        if (args.groupId) body.GroupID = args.groupId;
        if (args.tagIds) body.TagIDs = args.tagIds;
        const result = await client().post("/api/endpoints", body);
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("update_environment", "Update an existing environment/endpoint", {
      id: z.number().describe("Environment/endpoint ID"),
      name: z.string().optional().describe("New name"),
      publicURL: z.string().optional().describe("New public URL"),
      groupId: z.number().optional().describe("New group ID"),
      tagIds: z.array(z.number()).optional().describe("New tag IDs"),
    }, async (args) => {
      try {
        const body: Record<string, unknown> = {};
        if (args.name) body.Name = args.name;
        if (args.publicURL) body.PublicURL = args.publicURL;
        if (args.groupId) body.GroupID = args.groupId;
        if (args.tagIds) body.TagIDs = args.tagIds;
        const result = await client().put(`/api/endpoints/${args.id}`, body);
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("delete_environment", "Delete an environment/endpoint", {
      id: z.number().describe("Environment/endpoint ID"),
    }, async (args) => {
      try {
        await client().delete(`/api/endpoints/${args.id}`);
        return jsonResponse({ success: true });
      } catch (e) {
        return errorResponse(e);
      }
    });
  }
}
