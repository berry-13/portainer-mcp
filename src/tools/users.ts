import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ClientAccessor } from "../client.js";
import { jsonResponse, errorResponse, paginatedResponse } from "../utils/response.js";

export function registerUserTools(server: McpServer, client: ClientAccessor, readOnly: boolean): void {
  server.tool("list_users", "List all users", {
    limit: z.number().optional().describe("Max items to return"),
    offset: z.number().optional().describe("Items to skip"),
  }, async (args) => {
    try {
      const result = await client().get("/api/users") as unknown[];
      return paginatedResponse(result, args.limit, args.offset);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("get_user", "Get details of a user", {
    id: z.number().describe("User ID"),
  }, async (args) => {
    try {
      const result = await client().get(`/api/users/${args.id}`);
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });

  if (!readOnly) {
    server.tool("create_user", "Create a new user", {
      username: z.string().describe("Username"),
      password: z.string().describe("Password"),
      role: z.number().describe("Role (1=admin, 2=standard user)"),
    }, async (args) => {
      try {
        const result = await client().post("/api/users", {
          Username: args.username,
          Password: args.password,
          Role: args.role,
        });
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("update_user", "Update an existing user", {
      id: z.number().describe("User ID"),
      password: z.string().optional().describe("New password"),
      role: z.number().optional().describe("New role (1=admin, 2=standard user)"),
    }, async (args) => {
      try {
        const body: Record<string, unknown> = {};
        if (args.password) body.Password = args.password;
        if (args.role !== undefined) body.Role = args.role;
        const result = await client().put(`/api/users/${args.id}`, body);
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("delete_user", "Delete a user", {
      id: z.number().describe("User ID"),
    }, async (args) => {
      try {
        await client().delete(`/api/users/${args.id}`);
        return jsonResponse({ success: true });
      } catch (e) {
        return errorResponse(e);
      }
    });
  }
}
