import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PortainerClient } from "../client.js";
import { jsonResponse, errorResponse, paginatedResponse } from "../utils/response.js";

export function registerRegistryTools(server: McpServer, client: PortainerClient, readOnly: boolean): void {
  server.tool("list_registries", "List all registries", {
    limit: z.number().optional().describe("Max items to return"),
    offset: z.number().optional().describe("Items to skip"),
  }, async (args) => {
    try {
      const result = await client.get("/api/registries") as unknown[];
      return paginatedResponse(result, args.limit, args.offset);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("get_registry", "Get details of a registry", {
    id: z.number().describe("Registry ID"),
  }, async (args) => {
    try {
      const result = await client.get(`/api/registries/${args.id}`);
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });

  if (!readOnly) {
    server.tool("create_registry", "Create a new registry", {
      name: z.string().describe("Registry name"),
      type: z.number().describe("Registry type (1=Quay, 2=Azure, 3=Custom, 4=GitLab, 5=ProGet, 6=DockerHub, 7=ECR, 8=GitHub)"),
      url: z.string().describe("Registry URL"),
      authentication: z.boolean().optional().describe("Whether authentication is required"),
      username: z.string().optional().describe("Username for authentication"),
      password: z.string().optional().describe("Password for authentication"),
    }, async (args) => {
      try {
        const body: Record<string, unknown> = {
          Name: args.name,
          Type: args.type,
          URL: args.url,
        };
        if (args.authentication !== undefined) body.Authentication = args.authentication;
        if (args.username) body.Username = args.username;
        if (args.password) body.Password = args.password;
        const result = await client.post("/api/registries", body);
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("update_registry", "Update an existing registry", {
      id: z.number().describe("Registry ID"),
      name: z.string().optional().describe("New name"),
      url: z.string().optional().describe("New URL"),
      authentication: z.boolean().optional().describe("Whether authentication is required"),
      username: z.string().optional().describe("New username"),
      password: z.string().optional().describe("New password"),
    }, async (args) => {
      try {
        const body: Record<string, unknown> = {};
        if (args.name) body.Name = args.name;
        if (args.url) body.URL = args.url;
        if (args.authentication !== undefined) body.Authentication = args.authentication;
        if (args.username) body.Username = args.username;
        if (args.password) body.Password = args.password;
        const result = await client.put(`/api/registries/${args.id}`, body);
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("delete_registry", "Delete a registry", {
      id: z.number().describe("Registry ID"),
    }, async (args) => {
      try {
        await client.delete(`/api/registries/${args.id}`);
        return jsonResponse({ success: true });
      } catch (e) {
        return errorResponse(e);
      }
    });
  }
}
