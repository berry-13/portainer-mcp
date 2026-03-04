import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PortainerClient } from "./client.js";
import { registerAllTools } from "./tools/index.js";
import { registerResources } from "./resources.js";
import { Config } from "./config.js";

export function createServer(config: Config): McpServer {
  const server = new McpServer({
    name: "portainer-mcp",
    version: "1.0.0",
  });

  const client = new PortainerClient(config.server, config.token, config.skipTlsVerify, config.timeout);

  registerAllTools(server, client, config.readOnly);
  registerResources(server, client);

  return server;
}
