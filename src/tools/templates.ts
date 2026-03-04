import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PortainerClient } from "../client.js";
import { jsonResponse, errorResponse, paginatedResponse } from "../utils/response.js";

export function registerTemplateTools(server: McpServer, client: PortainerClient, readOnly: boolean): void {
  server.tool("list_templates", "List all app templates", {
    limit: z.number().optional().describe("Max items to return"),
    offset: z.number().optional().describe("Items to skip"),
  }, async (args) => {
    try {
      const result = await client.get("/api/templates") as unknown[];
      return paginatedResponse(result, args.limit, args.offset);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("list_custom_templates", "List all custom templates", {
    limit: z.number().optional().describe("Max items to return"),
    offset: z.number().optional().describe("Items to skip"),
  }, async (args) => {
    try {
      const result = await client.get("/api/custom_templates") as unknown[];
      return paginatedResponse(result, args.limit, args.offset);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("get_custom_template", "Get details of a custom template", {
    id: z.number().describe("Custom template ID"),
  }, async (args) => {
    try {
      const result = await client.get(`/api/custom_templates/${args.id}`);
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });

  if (!readOnly) {
    server.tool("create_custom_template", "Create a new custom template", {
      title: z.string().describe("Template title"),
      description: z.string().describe("Template description"),
      fileContent: z.string().describe("Docker Compose file content"),
      type: z.number().optional().describe("Stack type (1=swarm, 2=compose, 3=kubernetes)"),
      platform: z.number().optional().describe("Platform (1=linux, 2=windows)"),
      note: z.string().optional().describe("Usage note"),
      logo: z.string().optional().describe("Logo URL"),
    }, async (args) => {
      try {
        const body: Record<string, unknown> = {
          Title: args.title,
          Description: args.description,
          FileContent: args.fileContent,
        };
        if (args.type !== undefined) body.Type = args.type;
        if (args.platform !== undefined) body.Platform = args.platform;
        if (args.note) body.Note = args.note;
        if (args.logo) body.Logo = args.logo;
        const result = await client.post("/api/custom_templates", body);
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("update_custom_template", "Update a custom template", {
      id: z.number().describe("Custom template ID"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      fileContent: z.string().optional().describe("New Docker Compose file content"),
      note: z.string().optional().describe("New usage note"),
      logo: z.string().optional().describe("New logo URL"),
    }, async (args) => {
      try {
        const body: Record<string, unknown> = {};
        if (args.title) body.Title = args.title;
        if (args.description) body.Description = args.description;
        if (args.fileContent) body.FileContent = args.fileContent;
        if (args.note) body.Note = args.note;
        if (args.logo) body.Logo = args.logo;
        const result = await client.put(`/api/custom_templates/${args.id}`, body);
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("delete_custom_template", "Delete a custom template", {
      id: z.number().describe("Custom template ID"),
    }, async (args) => {
      try {
        await client.delete(`/api/custom_templates/${args.id}`);
        return jsonResponse({ success: true });
      } catch (e) {
        return errorResponse(e);
      }
    });
  }
}
