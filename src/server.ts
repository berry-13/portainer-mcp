import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools/index.js";
import { registerInstanceTools } from "./tools/instances.js";
import { registerResources } from "./resources.js";
import { InstanceManager } from "./instances.js";
import { Config } from "./config.js";

/**
 * Creates and configures the MCP server with all Portainer tools and resources.
 * Sets up the instance manager, registers tools (respecting read-only mode),
 * and registers MCP resources.
 * @param config - Application configuration
 * @returns A fully configured McpServer ready to be connected to a transport
 */
export function createServer(config: Config): McpServer {
  const server = new McpServer({
    name: "portainer-mcp",
    version: "1.0.0",
  });

  const manager = new InstanceManager({
    name: "default",
    url: config.server,
    token: config.token,
    skipTlsVerify: config.skipTlsVerify,
    timeout: config.timeout,
  });

  // Load additional instances from config
  for (const inst of config.instances) {
    manager.add({
      name: inst.name,
      url: inst.url.replace(/\/+$/, ""),
      token: inst.token,
      skipTlsVerify: inst.skipTlsVerify || false,
      timeout: inst.timeout || config.timeout,
    });
  }

  // Client accessor that always returns the active instance's client
  const client = () => manager.getActive();

  registerAllTools(server, client, config.readOnly);
  registerInstanceTools(server, manager);
  registerResources(server, client);

  return server;
}
