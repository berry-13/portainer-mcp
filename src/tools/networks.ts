import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ClientAccessor } from "../client.js";
import { jsonResponse, errorResponse, paginatedResponse } from "../utils/response.js";

export function registerNetworkTools(server: McpServer, client: ClientAccessor, readOnly: boolean): void {
  const eid = z.number().describe("Environment/endpoint ID");

  server.tool("list_networks", "List networks in an environment", {
    endpointId: eid,
    limit: z.number().optional().describe("Max items to return"),
    offset: z.number().optional().describe("Items to skip"),
  }, async (args) => {
    try {
      const result = await client().get(client().dockerPath(args.endpointId, "/networks")) as unknown[];
      return paginatedResponse(result, args.limit, args.offset);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("inspect_network", "Inspect a network", {
    endpointId: eid,
    id: z.string().describe("Network ID or name"),
  }, async (args) => {
    try {
      const result = await client().get(client().dockerPath(args.endpointId, `/networks/${args.id}`));
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });

  if (!readOnly) {
    server.tool("create_network", "Create a network", {
      endpointId: eid,
      name: z.string().describe("Network name"),
      driver: z.string().optional().describe("Network driver (default 'bridge')"),
      internal: z.boolean().optional().describe("Restrict external access"),
      attachable: z.boolean().optional().describe("Allow manual container attachment"),
      ipam: z.record(z.unknown()).optional().describe("IPAM configuration"),
      labels: z.record(z.string()).optional().describe("Network labels"),
    }, async (args) => {
      try {
        const body: Record<string, unknown> = { Name: args.name };
        if (args.driver) body.Driver = args.driver;
        if (args.internal !== undefined) body.Internal = args.internal;
        if (args.attachable !== undefined) body.Attachable = args.attachable;
        if (args.ipam) body.IPAM = args.ipam;
        if (args.labels) body.Labels = args.labels;
        const result = await client().post(client().dockerPath(args.endpointId, "/networks/create"), body);
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("remove_network", "Remove a network", {
      endpointId: eid,
      id: z.string().describe("Network ID or name"),
    }, async (args) => {
      try {
        await client().delete(client().dockerPath(args.endpointId, `/networks/${args.id}`));
        return jsonResponse({ success: true });
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("connect_network", "Connect a container to a network", {
      endpointId: eid,
      id: z.string().describe("Network ID or name"),
      container: z.string().describe("Container ID or name"),
    }, async (args) => {
      try {
        await client().post(client().dockerPath(args.endpointId, `/networks/${args.id}/connect`), { Container: args.container });
        return jsonResponse({ success: true });
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("disconnect_network", "Disconnect a container from a network", {
      endpointId: eid,
      id: z.string().describe("Network ID or name"),
      container: z.string().describe("Container ID or name"),
      force: z.boolean().optional().describe("Force disconnect"),
    }, async (args) => {
      try {
        await client().post(client().dockerPath(args.endpointId, `/networks/${args.id}/disconnect`), {
          Container: args.container,
          Force: args.force || false,
        });
        return jsonResponse({ success: true });
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("prune_networks", "Delete unused networks", {
      endpointId: eid,
    }, async (args) => {
      try {
        const result = await client().post(client().dockerPath(args.endpointId, "/networks/prune"));
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });
  }
}
