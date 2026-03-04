import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InstanceManager } from "../instances.js";
import { jsonResponse, errorResponse } from "../utils/response.js";

export function registerInstanceTools(server: McpServer, manager: InstanceManager): void {
  server.tool("list_instances", "List all configured Portainer instances", {}, async () => {
    try {
      return jsonResponse(manager.list());
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("switch_instance", "Switch the active Portainer instance", {
    name: z.string().describe("Instance name to switch to"),
  }, async (args) => {
    try {
      if (!manager.has(args.name)) {
        return errorResponse(new Error(`Instance '${args.name}' not found. Use list_instances to see available instances.`));
      }
      manager.switch(args.name);
      return jsonResponse({ success: true, active: args.name, instances: manager.list() });
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("add_instance", "Add a new Portainer instance", {
    name: z.string().describe("Unique name for this instance"),
    url: z.string().describe("Portainer server URL"),
    token: z.string().describe("API token"),
    skipTlsVerify: z.boolean().optional().describe("Skip TLS verification"),
    timeout: z.number().optional().describe("Request timeout in ms (default 30000)"),
  }, async (args) => {
    try {
      if (manager.has(args.name)) {
        return errorResponse(new Error(`Instance '${args.name}' already exists. Use a different name.`));
      }
      manager.add({
        name: args.name,
        url: args.url.replace(/\/+$/, ""),
        token: args.token,
        skipTlsVerify: args.skipTlsVerify || false,
        timeout: args.timeout || 30000,
      });
      return jsonResponse({ success: true, instances: manager.list() });
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("remove_instance", "Remove a Portainer instance", {
    name: z.string().describe("Instance name to remove"),
  }, async (args) => {
    try {
      if (!manager.has(args.name)) {
        return errorResponse(new Error(`Instance '${args.name}' not found.`));
      }
      if (!manager.remove(args.name)) {
        return errorResponse(new Error(`Cannot remove the active instance '${args.name}'. Switch to another instance first.`));
      }
      return jsonResponse({ success: true, instances: manager.list() });
    } catch (e) {
      return errorResponse(e);
    }
  });
}
