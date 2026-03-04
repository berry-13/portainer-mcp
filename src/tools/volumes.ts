import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ClientAccessor } from "../client.js";
import { jsonResponse, errorResponse, paginatedResponse } from "../utils/response.js";

export function registerVolumeTools(server: McpServer, client: ClientAccessor, readOnly: boolean): void {
  const eid = z.number().describe("Environment/endpoint ID");

  server.tool("list_volumes", "List volumes in an environment", {
    endpointId: eid,
    limit: z.number().optional().describe("Max items to return"),
    offset: z.number().optional().describe("Items to skip"),
  }, async (args) => {
    try {
      const result = await client().get(client().dockerPath(args.endpointId, "/volumes")) as Record<string, unknown>;
      const volumes = (result.Volumes || []) as unknown[];
      return paginatedResponse(volumes, args.limit, args.offset);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("inspect_volume", "Inspect a volume", {
    endpointId: eid,
    name: z.string().describe("Volume name"),
  }, async (args) => {
    try {
      const result = await client().get(client().dockerPath(args.endpointId, `/volumes/${args.name}`));
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });

  if (!readOnly) {
    server.tool("create_volume", "Create a volume", {
      endpointId: eid,
      name: z.string().optional().describe("Volume name (auto-generated if omitted)"),
      driver: z.string().optional().describe("Volume driver (default 'local')"),
      driverOpts: z.record(z.string()).optional().describe("Driver-specific options"),
      labels: z.record(z.string()).optional().describe("Volume labels"),
    }, async (args) => {
      try {
        const body: Record<string, unknown> = {};
        if (args.name) body.Name = args.name;
        if (args.driver) body.Driver = args.driver;
        if (args.driverOpts) body.DriverOpts = args.driverOpts;
        if (args.labels) body.Labels = args.labels;
        const result = await client().post(client().dockerPath(args.endpointId, "/volumes/create"), body);
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("remove_volume", "Remove a volume", {
      endpointId: eid,
      name: z.string().describe("Volume name"),
      force: z.boolean().optional().describe("Force removal"),
    }, async (args) => {
      try {
        const query: Record<string, string> = {};
        if (args.force) query.force = "true";
        await client().delete(client().dockerPath(args.endpointId, `/volumes/${args.name}`), query);
        return jsonResponse({ success: true });
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("prune_volumes", "Delete unused volumes", {
      endpointId: eid,
    }, async (args) => {
      try {
        const result = await client().post(client().dockerPath(args.endpointId, "/volumes/prune"));
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });
  }
}
