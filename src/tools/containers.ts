import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ClientAccessor } from "../client.js";
import { jsonResponse, textResponse, errorResponse } from "../utils/response.js";
import { paginatedResponse } from "../utils/response.js";
import { summarizeContainer, summarizeContainerInspect } from "../utils/filters.js";

export function registerContainerTools(server: McpServer, client: ClientAccessor, readOnly: boolean): void {
  const eid = z.number().describe("Environment/endpoint ID");

  // Read-only tools
  server.tool("list_containers", "List containers in an environment", {
    endpointId: eid,
    all: z.boolean().optional().describe("Show all containers (default shows only running)"),
    limit: z.number().optional(),
    offset: z.number().optional(),
    full: z.boolean().optional().describe("Return full Docker API response (default: summary)"),
  }, async (args) => {
    try {
      const query: Record<string, string> = {};
      if (args.all) query.all = "true";
      const result = await client().get(client().dockerPath(args.endpointId, "/containers/json"), query);
      const arr = result as Record<string, unknown>[];
      const items = args.full ? arr : arr.map(summarizeContainer);
      return paginatedResponse(items, args.limit, args.offset);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("inspect_container", "Inspect a container", {
    endpointId: eid,
    id: z.string().describe("Container ID or name"),
    full: z.boolean().optional().describe("Return full Docker API response (default: summary)"),
  }, async (args) => {
    try {
      const result = await client().get(client().dockerPath(args.endpointId, `/containers/${args.id}/json`));
      if (!args.full) {
        return jsonResponse(summarizeContainerInspect(result as Record<string, unknown>));
      }
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("container_logs", "Get container logs", {
    endpointId: eid,
    id: z.string().describe("Container ID or name"),
    tail: z.string().optional().describe("Number of lines from the end (default 'all')"),
    stdout: z.boolean().optional().describe("Show stdout (default true)"),
    stderr: z.boolean().optional().describe("Show stderr (default true)"),
    filter: z.string().optional().describe("Filter log lines containing this string (case-insensitive grep)"),
  }, async (args) => {
    try {
      const query: Record<string, string> = { follow: "false" };
      query.stdout = args.stdout !== false ? "true" : "false";
      query.stderr = args.stderr !== false ? "true" : "false";
      if (args.tail) query.tail = args.tail;
      const result = await client().get(client().dockerPath(args.endpointId, `/containers/${args.id}/logs`), query);
      let text = String(result);
      if (args.filter) {
        const filterLower = args.filter.toLowerCase();
        text = text.split("\n").filter(line => line.toLowerCase().includes(filterLower)).join("\n");
      }
      return textResponse(text);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("container_stats", "Get container resource usage statistics (single snapshot)", {
    endpointId: eid,
    id: z.string().describe("Container ID or name"),
  }, async (args) => {
    try {
      const result = await client().get(client().dockerPath(args.endpointId, `/containers/${args.id}/stats`), { stream: "false" });
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("container_processes", "List processes running inside a container", {
    endpointId: eid,
    id: z.string().describe("Container ID or name"),
  }, async (args) => {
    try {
      const result = await client().get(client().dockerPath(args.endpointId, `/containers/${args.id}/top`));
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("read_file_from_container", "Read a file from inside a container", {
    endpointId: eid,
    id: z.string().describe("Container ID or name"),
    path: z.string().describe("Absolute path to the file inside the container"),
  }, async (args) => {
    try {
      // Use exec to cat the file - works for text files
      const execBody = {
        Cmd: ["cat", args.path],
        AttachStdout: true,
        AttachStderr: true,
      };
      const execResult = await client().post(
        client().dockerPath(args.endpointId, `/containers/${args.id}/exec`),
        execBody
      ) as { Id: string };

      const output = await client().post(
        client().dockerPath(args.endpointId, `/exec/${execResult.Id}/start`),
        { Detach: false, Tty: false }
      );
      return textResponse(String(output));
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("list_files_in_container", "List files in a directory inside a container", {
    endpointId: eid,
    id: z.string().describe("Container ID or name"),
    path: z.string().describe("Absolute directory path inside the container"),
  }, async (args) => {
    try {
      const execBody = {
        Cmd: ["ls", "-la", args.path],
        AttachStdout: true,
        AttachStderr: true,
      };
      const execResult = await client().post(
        client().dockerPath(args.endpointId, `/containers/${args.id}/exec`),
        execBody
      ) as { Id: string };

      const output = await client().post(
        client().dockerPath(args.endpointId, `/exec/${execResult.Id}/start`),
        { Detach: false, Tty: false }
      );
      return textResponse(String(output));
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("diff_container", "Show filesystem changes in a container since creation", {
    endpointId: eid,
    id: z.string().describe("Container ID or name"),
  }, async (args) => {
    try {
      const result = await client().get(client().dockerPath(args.endpointId, `/containers/${args.id}/changes`));
      const changes = result as Array<{ Path: string; Kind: number }> | null;
      if (!changes || changes.length === 0) {
        return textResponse("No filesystem changes detected.");
      }
      const kindMap: Record<number, string> = { 0: "Modified", 1: "Added", 2: "Deleted" };
      const formatted = changes.map(c => `${kindMap[c.Kind] || "Unknown"}: ${c.Path}`).join("\n");
      return textResponse(formatted);
    } catch (e) {
      return errorResponse(e);
    }
  });

  if (!readOnly) {
    server.tool("write_file_to_container", "Write content to a file inside a container", {
      endpointId: eid,
      id: z.string().describe("Container ID or name"),
      path: z.string().describe("Absolute path to the file inside the container"),
      content: z.string().describe("File content to write"),
    }, async (args) => {
      try {
        // Use exec with sh -c to write file content
        const escaped = args.content.replace(/'/g, "'\\''");
        const execBody = {
          Cmd: ["sh", "-c", `cat > '${args.path}' << 'PORTAINER_MCP_EOF'\n${args.content}\nPORTAINER_MCP_EOF`],
          AttachStdout: true,
          AttachStderr: true,
        };
        const execResult = await client().post(
          client().dockerPath(args.endpointId, `/containers/${args.id}/exec`),
          execBody
        ) as { Id: string };

        const output = await client().post(
          client().dockerPath(args.endpointId, `/exec/${execResult.Id}/start`),
          { Detach: false, Tty: false }
        );
        const text = String(output).trim();
        if (text) {
          return textResponse(`File written. Output: ${text}`);
        }
        return jsonResponse({ success: true, path: args.path });
      } catch (e) {
        return errorResponse(e);
      }
    });


    server.tool("create_container", "Create a new container", {
      endpointId: eid,
      name: z.string().optional().describe("Container name"),
      image: z.string().describe("Image to use"),
      cmd: z.array(z.string()).optional().describe("Command to run"),
      env: z.array(z.string()).optional().describe("Environment variables (KEY=VALUE)"),
      exposedPorts: z.record(z.object({})).optional().describe("Exposed ports (e.g. {'80/tcp': {}})"),
      hostConfig: z.record(z.unknown()).optional().describe("Host configuration (port bindings, volumes, etc.)"),
      networkingConfig: z.record(z.unknown()).optional().describe("Networking configuration"),
      labels: z.record(z.string()).optional().describe("Container labels"),
    }, async (args) => {
      try {
        const query: Record<string, string> = {};
        if (args.name) query.name = args.name;
        const body: Record<string, unknown> = { Image: args.image };
        if (args.cmd) body.Cmd = args.cmd;
        if (args.env) body.Env = args.env;
        if (args.exposedPorts) body.ExposedPorts = args.exposedPorts;
        if (args.hostConfig) body.HostConfig = args.hostConfig;
        if (args.networkingConfig) body.NetworkingConfig = args.networkingConfig;
        if (args.labels) body.Labels = args.labels;
        const result = await client().post(client().dockerPath(args.endpointId, "/containers/create"), body, query);
        return jsonResponse(result);
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("start_container", "Start a stopped container", {
      endpointId: eid,
      id: z.string().describe("Container ID or name"),
    }, async (args) => {
      try {
        await client().post(client().dockerPath(args.endpointId, `/containers/${args.id}/start`));
        return jsonResponse({ success: true });
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("stop_container", "Stop a running container", {
      endpointId: eid,
      id: z.string().describe("Container ID or name"),
      t: z.number().optional().describe("Seconds to wait before killing (default 10)"),
    }, async (args) => {
      try {
        const query: Record<string, string> = {};
        if (args.t !== undefined) query.t = String(args.t);
        await client().post(client().dockerPath(args.endpointId, `/containers/${args.id}/stop`), undefined, query);
        return jsonResponse({ success: true });
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("restart_container", "Restart a container", {
      endpointId: eid,
      id: z.string().describe("Container ID or name"),
      t: z.number().optional().describe("Seconds to wait before killing (default 10)"),
    }, async (args) => {
      try {
        const query: Record<string, string> = {};
        if (args.t !== undefined) query.t = String(args.t);
        await client().post(client().dockerPath(args.endpointId, `/containers/${args.id}/restart`), undefined, query);
        return jsonResponse({ success: true });
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("remove_container", "Remove a container", {
      endpointId: eid,
      id: z.string().describe("Container ID or name"),
      force: z.boolean().optional().describe("Force remove running container"),
      v: z.boolean().optional().describe("Remove associated volumes"),
    }, async (args) => {
      try {
        const query: Record<string, string> = {};
        if (args.force) query.force = "true";
        if (args.v) query.v = "true";
        await client().delete(client().dockerPath(args.endpointId, `/containers/${args.id}`), query);
        return jsonResponse({ success: true });
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("kill_container", "Kill a running container", {
      endpointId: eid,
      id: z.string().describe("Container ID or name"),
      signal: z.string().optional().describe("Signal to send (default SIGKILL)"),
    }, async (args) => {
      try {
        const query: Record<string, string> = {};
        if (args.signal) query.signal = args.signal;
        await client().post(client().dockerPath(args.endpointId, `/containers/${args.id}/kill`), undefined, query);
        return jsonResponse({ success: true });
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("pause_container", "Pause a running container", {
      endpointId: eid,
      id: z.string().describe("Container ID or name"),
    }, async (args) => {
      try {
        await client().post(client().dockerPath(args.endpointId, `/containers/${args.id}/pause`));
        return jsonResponse({ success: true });
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("unpause_container", "Unpause a paused container", {
      endpointId: eid,
      id: z.string().describe("Container ID or name"),
    }, async (args) => {
      try {
        await client().post(client().dockerPath(args.endpointId, `/containers/${args.id}/unpause`));
        return jsonResponse({ success: true });
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("rename_container", "Rename a container", {
      endpointId: eid,
      id: z.string().describe("Container ID or name"),
      name: z.string().describe("New container name"),
    }, async (args) => {
      try {
        await client().post(client().dockerPath(args.endpointId, `/containers/${args.id}/rename`), undefined, { name: args.name });
        return jsonResponse({ success: true });
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("exec_container", "Execute a command inside a running container", {
      endpointId: eid,
      id: z.string().describe("Container ID or name"),
      cmd: z.array(z.string()).describe("Command to execute"),
      attachStdout: z.boolean().optional().describe("Attach stdout (default true)"),
      attachStderr: z.boolean().optional().describe("Attach stderr (default true)"),
      workingDir: z.string().optional().describe("Working directory inside the container"),
      env: z.array(z.string()).optional().describe("Environment variables"),
      user: z.string().optional().describe("User to run command as"),
    }, async (args) => {
      try {
        const execBody: Record<string, unknown> = {
          Cmd: args.cmd,
          AttachStdout: args.attachStdout !== false,
          AttachStderr: args.attachStderr !== false,
        };
        if (args.workingDir) execBody.WorkingDir = args.workingDir;
        if (args.env) execBody.Env = args.env;
        if (args.user) execBody.User = args.user;

        const execResult = await client().post(
          client().dockerPath(args.endpointId, `/containers/${args.id}/exec`),
          execBody
        ) as { Id: string };

        const startResult = await client().post(
          client().dockerPath(args.endpointId, `/exec/${execResult.Id}/start`),
          { Detach: false, Tty: false }
        );
        return textResponse(String(startResult));
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("bulk_start_containers", "Start multiple containers matching a name pattern or label", {
      endpointId: eid,
      namePattern: z.string().optional().describe("Regex pattern to match container names"),
      label: z.string().optional().describe("Label filter (e.g. 'app=web')"),
    }, async (args) => {
      try {
        if (!args.namePattern && !args.label) {
          return errorResponse(new Error("Must specify namePattern or label"));
        }
        const query: Record<string, string> = { all: "true" };
        if (args.label) {
          query.filters = JSON.stringify({ label: [args.label] });
        }
        const containers = await client().get(client().dockerPath(args.endpointId, "/containers/json"), query) as Array<Record<string, unknown>>;
        let targets = containers;
        if (args.namePattern) {
          const re = new RegExp(args.namePattern, "i");
          targets = targets.filter(c => {
            const names = c.Names as string[] | undefined;
            return names?.some(n => re.test(n));
          });
        }
        const results: Record<string, string> = {};
        for (const c of targets) {
          const id = (c.Id as string).slice(0, 12);
          const name = ((c.Names as string[])?.[0] || id).replace(/^\//, "");
          try {
            await client().post(client().dockerPath(args.endpointId, `/containers/${c.Id}/start`));
            results[name] = "started";
          } catch (e) {
            results[name] = `error: ${e instanceof Error ? e.message : String(e)}`;
          }
        }
        return jsonResponse({ matched: targets.length, results });
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("bulk_stop_containers", "Stop multiple containers matching a name pattern or label", {
      endpointId: eid,
      namePattern: z.string().optional().describe("Regex pattern to match container names"),
      label: z.string().optional().describe("Label filter (e.g. 'app=web')"),
      t: z.number().optional().describe("Seconds to wait before killing"),
    }, async (args) => {
      try {
        if (!args.namePattern && !args.label) {
          return errorResponse(new Error("Must specify namePattern or label"));
        }
        const query: Record<string, string> = {};
        if (args.label) {
          query.filters = JSON.stringify({ label: [args.label] });
        }
        const containers = await client().get(client().dockerPath(args.endpointId, "/containers/json"), query) as Array<Record<string, unknown>>;
        let targets = containers;
        if (args.namePattern) {
          const re = new RegExp(args.namePattern, "i");
          targets = targets.filter(c => {
            const names = c.Names as string[] | undefined;
            return names?.some(n => re.test(n));
          });
        }
        const stopQuery: Record<string, string> = {};
        if (args.t !== undefined) stopQuery.t = String(args.t);
        const results: Record<string, string> = {};
        for (const c of targets) {
          const name = ((c.Names as string[])?.[0] || (c.Id as string).slice(0, 12)).replace(/^\//, "");
          try {
            await client().post(client().dockerPath(args.endpointId, `/containers/${c.Id}/stop`), undefined, stopQuery);
            results[name] = "stopped";
          } catch (e) {
            results[name] = `error: ${e instanceof Error ? e.message : String(e)}`;
          }
        }
        return jsonResponse({ matched: targets.length, results });
      } catch (e) {
        return errorResponse(e);
      }
    });

    server.tool("bulk_restart_containers", "Restart multiple containers matching a name pattern or label", {
      endpointId: eid,
      namePattern: z.string().optional().describe("Regex pattern to match container names"),
      label: z.string().optional().describe("Label filter (e.g. 'app=web')"),
      t: z.number().optional().describe("Seconds to wait before killing"),
    }, async (args) => {
      try {
        if (!args.namePattern && !args.label) {
          return errorResponse(new Error("Must specify namePattern or label"));
        }
        const query: Record<string, string> = {};
        if (args.label) {
          query.filters = JSON.stringify({ label: [args.label] });
        }
        const containers = await client().get(client().dockerPath(args.endpointId, "/containers/json"), query) as Array<Record<string, unknown>>;
        let targets = containers;
        if (args.namePattern) {
          const re = new RegExp(args.namePattern, "i");
          targets = targets.filter(c => {
            const names = c.Names as string[] | undefined;
            return names?.some(n => re.test(n));
          });
        }
        const restartQuery: Record<string, string> = {};
        if (args.t !== undefined) restartQuery.t = String(args.t);
        const results: Record<string, string> = {};
        for (const c of targets) {
          const name = ((c.Names as string[])?.[0] || (c.Id as string).slice(0, 12)).replace(/^\//, "");
          try {
            await client().post(client().dockerPath(args.endpointId, `/containers/${c.Id}/restart`), undefined, restartQuery);
            results[name] = "restarted";
          } catch (e) {
            results[name] = `error: ${e instanceof Error ? e.message : String(e)}`;
          }
        }
        return jsonResponse({ matched: targets.length, results });
      } catch (e) {
        return errorResponse(e);
      }
    });
  }
}
