import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PortainerClient } from "../client.js";
import { jsonResponse, errorResponse, paginatedResponse } from "../utils/response.js";

export function registerTeamTools(server: McpServer, client: PortainerClient, readOnly: boolean): void {
  server.tool("list_teams", "List all teams", {
    limit: z.number().optional().describe("Max items to return"),
    offset: z.number().optional().describe("Items to skip"),
  }, async (args) => {
    try {
      const result = await client.get("/api/teams") as unknown[];
      return paginatedResponse(result, args.limit, args.offset);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("get_team", "Get details of a team", {
    id: z.number().describe("Team ID"),
  }, async (args) => {
    try {
      const result = await client.get(`/api/teams/${args.id}`);
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("list_team_members", "List members of a team", {
    id: z.number().describe("Team ID"),
  }, async (args) => {
    try {
      const result = await client.get(`/api/teams/${args.id}/memberships`);
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });

  if (!readOnly) {
    server.tool("create_team", "Create a new team", {
      name: z.string().describe("Team name"),
    }, async (args) => {
      try {
        const result = await client.post("/api/teams", { Name: args.name });
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("update_team", "Update a team", {
      id: z.number().describe("Team ID"),
      name: z.string().describe("New team name"),
    }, async (args) => {
      try {
        const result = await client.put(`/api/teams/${args.id}`, { Name: args.name });
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("delete_team", "Delete a team", {
      id: z.number().describe("Team ID"),
    }, async (args) => {
      try {
        await client.delete(`/api/teams/${args.id}`);
        return jsonResponse({ success: true });
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("add_team_member", "Add a user to a team", {
      id: z.number().describe("Team ID"),
      userId: z.number().describe("User ID to add"),
      role: z.number().optional().describe("Role in team (1=leader, 2=member)"),
    }, async (args) => {
      try {
        const result = await client.post(`/api/teams/${args.id}/memberships`, {
          UserID: args.userId,
          Role: args.role || 2,
        });
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("remove_team_member", "Remove a user from a team", {
      id: z.number().describe("Team ID"),
      userId: z.number().describe("User ID to remove"),
    }, async (args) => {
      try {
        await client.delete(`/api/teams/${args.id}/memberships/${args.userId}`);
        return jsonResponse({ success: true });
      } catch (e) {
        return errorResponse(e);
      }
    });
  }
}
