import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ClientAccessor } from "../client.js";
import { jsonResponse, textResponse, errorResponse, paginatedResponse } from "../utils/response.js";
import { validateCompose } from "../utils/compose.js";
import { diffComposeServices } from "../utils/diff.js";

export function registerStackTools(server: McpServer, client: ClientAccessor, readOnly: boolean): void {
  server.tool("list_stacks", "List all stacks", {
    limit: z.number().optional().describe("Max items to return"),
    offset: z.number().optional().describe("Items to skip"),
  }, async (args) => {
    try {
      const result = await client().get("/api/stacks") as unknown[];
      return paginatedResponse(result, args.limit, args.offset);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("get_stack", "Get details of a stack", {
    id: z.number().describe("Stack ID"),
  }, async (args) => {
    try {
      const result = await client().get(`/api/stacks/${args.id}`);
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("get_stack_file", "Get the compose file content of a stack", {
    id: z.number().describe("Stack ID"),
  }, async (args) => {
    try {
      const result = await client().get(`/api/stacks/${args.id}/file`);
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

  server.tool("diff_stack", "Compare a stack's current compose file with a proposed new version", {
    id: z.number().describe("Stack ID"),
    proposedContent: z.string().describe("Proposed new Docker Compose file content"),
  }, async (args) => {
    try {
      const stackFile = await client().get(`/api/stacks/${args.id}/file`) as Record<string, unknown>;
      const currentContent = stackFile.StackFileContent as string;
      const result = diffComposeServices(currentContent, args.proposedContent);
      return jsonResponse({
        summary: {
          addedServices: result.added,
          removedServices: result.removed,
          modifiedServices: result.modified,
          unchangedServices: result.unchanged,
        },
        diff: result.diffText,
      });
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
        const result = await client().post(
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
        const result = await client().put(
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
        await client().delete(`/api/stacks/${args.id}`, { endpointId: String(args.endpointId) });
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
        const result = await client().post(`/api/stacks/${args.id}/start`, undefined, { endpointId: String(args.endpointId) });
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
        const result = await client().post(`/api/stacks/${args.id}/stop`, undefined, { endpointId: String(args.endpointId) });
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
        const stackFile = await client().get(`/api/stacks/${args.id}/file`) as Record<string, unknown>;
        const fileContent = stackFile.StackFileContent as string;
        steps.push("Retrieved current stack file");

        // Stop the stack
        try {
          await client().post(`/api/stacks/${args.id}/stop`, undefined, { endpointId: String(args.endpointId) });
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
        await client().put(`/api/stacks/${args.id}`, body, { endpointId: String(args.endpointId) });
        steps.push("Updated stack (pulled images)");

        // Start the stack
        await client().post(`/api/stacks/${args.id}/start`, undefined, { endpointId: String(args.endpointId) });
        steps.push("Started stack");

        return jsonResponse({ success: true, steps });
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("rollback_stack", "Rollback a stack to its previous compose file (uses Portainer's git-based stack versioning)", {
      id: z.number().describe("Stack ID"),
      endpointId: z.number().describe("Environment/endpoint ID"),
      previousContent: z.string().optional().describe("Previous compose file content to rollback to (if not provided, tries to fetch from Portainer's stack history)"),
    }, async (args) => {
      try {
        const steps: string[] = [];

        let rollbackContent = args.previousContent;

        if (!rollbackContent) {
          // Try to get previous version from Portainer's resource control / git history
          try {
            const stack = await client().get(`/api/stacks/${args.id}`) as Record<string, unknown>;
            const gitConfig = stack.GitConfig as Record<string, unknown> | undefined;
            if (gitConfig) {
              steps.push("Stack uses git-based deployment. Use git to revert and update the stack with the previous commit's compose file.");
              return jsonResponse({
                success: false,
                message: "Git-based stack detected. Provide the previous compose file content in the 'previousContent' parameter, or revert the git commit and use update_stack.",
                gitConfig: {
                  url: gitConfig.URL,
                  referenceName: gitConfig.ReferenceName,
                  configFilePath: gitConfig.ConfigFilePath,
                },
              });
            }
          } catch {
            // Ignore
          }

          return errorResponse(new Error("No previousContent provided and no automatic rollback source available. Provide the previous compose file content in the 'previousContent' parameter."));
        }

        // Validate the rollback content
        const { validateCompose } = await import("../utils/compose.js");
        const validation = validateCompose(rollbackContent);
        if (!validation.valid) {
          return errorResponse(new Error(`Rollback content validation failed: ${validation.errors.join("; ")}`));
        }
        steps.push("Validated rollback compose file");

        // Stop current stack
        try {
          await client().post(`/api/stacks/${args.id}/stop`, undefined, { endpointId: String(args.endpointId) });
          steps.push("Stopped current stack");
        } catch {
          steps.push("Stack was already stopped");
        }

        // Update with previous content
        await client().put(`/api/stacks/${args.id}`, {
          StackFileContent: rollbackContent,
          PullImage: true,
          Prune: true,
        }, { endpointId: String(args.endpointId) });
        steps.push("Updated stack with rollback content");

        // Start the stack
        await client().post(`/api/stacks/${args.id}/start`, undefined, { endpointId: String(args.endpointId) });
        steps.push("Started rolled-back stack");

        return jsonResponse({ success: true, steps });
      } catch (e) {
        return errorResponse(e);
      }
    });
  }
}
