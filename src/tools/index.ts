import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ClientAccessor } from "../client.js";
import { registerSystemTools } from "./system.js";
import { registerEnvironmentTools } from "./environments.js";
import { registerContainerTools } from "./containers.js";
import { registerImageTools } from "./images.js";
import { registerVolumeTools } from "./volumes.js";
import { registerNetworkTools } from "./networks.js";
import { registerStackTools } from "./stacks.js";
import { registerRegistryTools } from "./registries.js";
import { registerUserTools } from "./users.js";
import { registerTeamTools } from "./teams.js";
import { registerTemplateTools } from "./templates.js";
import { registerTagTools } from "./tags.js";
import { registerWebhookTools } from "./webhooks.js";

/**
 * Registers all Portainer MCP tools on the server. Includes tools for
 * system, environments, containers, images, volumes, networks, stacks,
 * registries, users, teams, templates, tags, and webhooks.
 * @param server - The MCP server to register tools on
 * @param client - Accessor function that returns the active PortainerClient
 * @param readOnly - When true, write/mutating tools are not registered
 */
export function registerAllTools(server: McpServer, client: ClientAccessor, readOnly: boolean): void {
  registerSystemTools(server, client, readOnly);
  registerEnvironmentTools(server, client, readOnly);
  registerContainerTools(server, client, readOnly);
  registerImageTools(server, client, readOnly);
  registerVolumeTools(server, client, readOnly);
  registerNetworkTools(server, client, readOnly);
  registerStackTools(server, client, readOnly);
  registerRegistryTools(server, client, readOnly);
  registerUserTools(server, client, readOnly);
  registerTeamTools(server, client, readOnly);
  registerTemplateTools(server, client, readOnly);
  registerTagTools(server, client, readOnly);
  registerWebhookTools(server, client, readOnly);
}
