import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PortainerClient } from "../client.js";
import { jsonResponse, textResponse, errorResponse, paginatedResponse } from "../utils/response.js";
import { validateCompose } from "../utils/compose.js";

export function registerStackTools(server: McpServer, client: PortainerClient, readOnly: boolean): void {
  server.tool("list_stacks", "List all stacks", {
    limit: z.number().optional().describe("Max items to return"),
    offset: z.number().optional().describe("Items to skip"),
  }, async (args) => {
    try {
      const result = await client.get("/api/stacks") as unknown[];
      return paginatedResponse(result, args.limit, args.offset);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("get_stack", "Get details of a stack", {
    id: z.number().describe("Stack ID"),
  }, async (args) => {
    try {
      const result = await client.get(`/api/stacks/${args.id}`);
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("get_stack_file", "Get the compose file content of a stack", {
    id: z.number().describe("Stack ID"),
  }, async (args) => {
    try {
      const result = await client.get(`/api/stacks/${args.id}/file`);
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("validate_compose", "Validate a Docker Compose file without deploying", {
    content: z.string().describe("Docker Compose file content to validate"),
  }, async (args) => {
    try {
      const result = validateCompose(args.content);
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });

  if (!readOnly) {
    server.tool("create_stack", "Create a new stack from a compose file string (validates compose syntax first)", {
      name: z.string().describe("Stack name"),
      endpointId: z.number().describe("Environment/endpoint ID to deploy to"),
      stackFileContent: z.string().describe("Docker Compose file content as string"),
      env: z.array(z.object({
        name: z.string(),
        value: z.string(),
      })).optional().describe("Environment variables for the stack"),
    }, async (args) => {
      try {
        const validation = validateCompose(args.stackFileContent);
        if (!validation.valid) {
          return errorResponse(new Error(`Compose validation failed: ${validation.errors.join("; ")}`));
        }
        const body: Record<string, unknown> = {
          Name: args.name,
          StackFileContent: args.stackFileContent,
        };
        if (args.env) body.Env = args.env;
        const result = await client.post(
          "/api/stacks/create/standalone/string",
          body,
          { endpointId: String(args.endpointId) }
        );
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("update_stack", "Update an existing stack (validates compose syntax first)", {
      id: z.number().describe("Stack ID"),
      endpointId: z.number().describe("Environment/endpoint ID"),
      stackFileContent: z.string().describe("Updated Docker Compose file content"),
      env: z.array(z.object({
        name: z.string(),
        value: z.string(),
      })).optional().describe("Environment variables"),
      prune: z.boolean().optional().describe("Prune services that are no longer referenced"),
      pullImage: z.boolean().optional().describe("Pull updated images"),
    }, async (args) => {
      try {
        const validation = validateCompose(args.stackFileContent);
        if (!validation.valid) {
          return errorResponse(new Error(`Compose validation failed: ${validation.errors.join("; ")}`));
        }
        const body: Record<string, unknown> = {
          StackFileContent: args.stackFileContent,
        };
        if (args.env) body.Env = args.env;
        if (args.prune !== undefined) body.Prune = args.prune;
        if (args.pullImage !== undefined) body.PullImage = args.pullImage;
        const result = await client.put(
          `/api/stacks/${args.id}`,
          body,
          { endpointId: String(args.endpointId) }
        );
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("delete_stack", "Delete a stack", {
      id: z.number().describe("Stack ID"),
      endpointId: z.number().describe("Environment/endpoint ID"),
    }, async (args) => {
      try {
        await client.delete(`/api/stacks/${args.id}`, { endpointId: String(args.endpointId) });
        return jsonResponse({ success: true });
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("start_stack", "Start a stopped stack", {
      id: z.number().describe("Stack ID"),
      endpointId: z.number().describe("Environment/endpoint ID"),
    }, async (args) => {
      try {
        const result = await client.post(`/api/stacks/${args.id}/start`, undefined, { endpointId: String(args.endpointId) });
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("stop_stack", "Stop a running stack", {
      id: z.number().describe("Stack ID"),
      endpointId: z.number().describe("Environment/endpoint ID"),
    }, async (args) => {
      try {
        const result = await client.post(`/api/stacks/${args.id}/stop`, undefined, { endpointId: String(args.endpointId) });
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("recreate_stack", "Recreate a stack (stop, pull images, update, start) in a single operation", {
      id: z.number().describe("Stack ID"),
      endpointId: z.number().describe("Environment/endpoint ID"),
      pullImage: z.boolean().optional().describe("Pull updated images before redeploying (default true)"),
      prune: z.boolean().optional().describe("Prune removed services (default true)"),
    }, async (args) => {
      try {
        const steps: string[] = [];

        // Get current stack file
        const stackFile = await client.get(`/api/stacks/${args.id}/file`) as Record<string, unknown>;
        const fileContent = stackFile.StackFileContent as string;
        steps.push("Retrieved current stack file");

        // Stop the stack
        try {
          await client.post(`/api/stacks/${args.id}/stop`, undefined, { endpointId: String(args.endpointId) });
          steps.push("Stopped stack");
        } catch {
          steps.push("Stack was already stopped (or stop failed, continuing)");
        }

        // Update with pull + prune
        const body: Record<string, unknown> = {
          StackFileContent: fileContent,
          PullImage: args.pullImage !== false,
          Prune: args.prune !== false,
        };
        await client.put(`/api/stacks/${args.id}`, body, { endpointId: String(args.endpointId) });
        steps.push("Updated stack (pulled images)");

        // Start the stack
        await client.post(`/api/stacks/${args.id}/start`, undefined, { endpointId: String(args.endpointId) });
        steps.push("Started stack");

        return jsonResponse({ success: true, steps });
      } catch (e) {
        return errorResponse(e);
      }
    });
  }
}
