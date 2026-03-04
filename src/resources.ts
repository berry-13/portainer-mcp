import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PortainerClient } from "./client.js";

export function registerResources(server: McpServer, client: PortainerClient): void {
  // Static resource: list of all environments
  server.resource(
    "environments",
    "portainer://environments",
    { description: "List of all Portainer environments/endpoints", mimeType: "application/json" },
    async () => {
      try {
        const result = await client.get("/api/endpoints");
        return {
          contents: [{
            uri: "portainer://environments",
            mimeType: "application/json",
            text: JSON.stringify(result),
          }],
        };
      } catch {
        return { contents: [{ uri: "portainer://environments", mimeType: "text/plain", text: "Failed to fetch environments" }] };
      }
    }
  );

  // Static resource: system status
  server.resource(
    "system-status",
    "portainer://system/status",
    { description: "Portainer system status", mimeType: "application/json" },
    async () => {
      try {
        const result = await client.get("/api/system/status");
        return {
          contents: [{
            uri: "portainer://system/status",
            mimeType: "application/json",
            text: JSON.stringify(result),
          }],
        };
      } catch {
        return { contents: [{ uri: "portainer://system/status", mimeType: "text/plain", text: "Failed to fetch status" }] };
      }
    }
  );

  // Resource template: environment details by ID
  server.resource(
    "environment",
    new ResourceTemplate("portainer://environments/{id}", { list: undefined }),
    { description: "Details of a specific Portainer environment", mimeType: "application/json" },
    async (uri, params) => {
      const id = params.id as string;
      try {
        const result = await client.get(`/api/endpoints/${id}`);
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(result),
          }],
        };
      } catch {
        return { contents: [{ uri: uri.href, mimeType: "text/plain", text: `Failed to fetch environment ${id}` }] };
      }
    }
  );

  // Resource template: containers in an environment
  server.resource(
    "containers",
    new ResourceTemplate("portainer://environments/{id}/containers", { list: undefined }),
    { description: "List of containers in a Portainer environment", mimeType: "application/json" },
    async (uri, params) => {
      const id = params.id as string;
      try {
        const result = await client.get(client.dockerPath(Number(id), "/containers/json"), { all: "true" });
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(result),
          }],
        };
      } catch {
        return { contents: [{ uri: uri.href, mimeType: "text/plain", text: `Failed to fetch containers for environment ${id}` }] };
      }
    }
  );

  // Resource template: stacks
  server.resource(
    "stacks",
    "portainer://stacks",
    { description: "List of all Portainer stacks", mimeType: "application/json" },
    async () => {
      try {
        const result = await client.get("/api/stacks");
        return {
          contents: [{
            uri: "portainer://stacks",
            mimeType: "application/json",
            text: JSON.stringify(result),
          }],
        };
      } catch {
        return { contents: [{ uri: "portainer://stacks", mimeType: "text/plain", text: "Failed to fetch stacks" }] };
      }
    }
  );
}
