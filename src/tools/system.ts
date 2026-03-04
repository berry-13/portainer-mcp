import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PortainerClient } from "../client.js";
import { jsonResponse, errorResponse } from "../utils/response.js";

export function registerSystemTools(server: McpServer, client: PortainerClient, readOnly: boolean): void {
  server.tool("get_status", "Get Portainer system status", {}, async () => {
    try {
      const result = await client.get("/api/system/status");
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("get_settings", "Get Portainer settings", {}, async () => {
    try {
      const result = await client.get("/api/settings");
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("health_check", "Check Portainer health and environment connectivity", {}, async () => {
    try {
      const health: Record<string, unknown> = {};

      // Check Portainer status
      try {
        const status = await client.get("/api/system/status");
        health.portainer = { status: "healthy", details: status };
      } catch (e) {
        health.portainer = { status: "unhealthy", error: e instanceof Error ? e.message : String(e) };
      }

      // Check environments
      try {
        const endpoints = await client.get("/api/endpoints") as Array<Record<string, unknown>>;
        const envResults: Record<string, unknown>[] = [];
        for (const ep of endpoints) {
          const envHealth: Record<string, unknown> = {
            id: ep.Id,
            name: ep.Name,
            type: ep.Type,
            status: ep.Status === 1 ? "up" : "down",
          };
          // Try Docker ping for Docker environments
          if (ep.Type === 1 || ep.Type === 2) {
            try {
              await client.get(client.dockerPath(ep.Id as number, "/_ping"));
              envHealth.docker = "reachable";
            } catch {
              envHealth.docker = "unreachable";
            }
          }
          envResults.push(envHealth);
        }
        health.environments = envResults;
      } catch (e) {
        health.environments = { error: e instanceof Error ? e.message : String(e) };
      }

      return jsonResponse(health);
    } catch (e) {
      return errorResponse(e);
    }
  });
}
