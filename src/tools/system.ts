import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ClientAccessor } from "../client.js";
import { jsonResponse, errorResponse } from "../utils/response.js";

export function registerSystemTools(server: McpServer, client: ClientAccessor, readOnly: boolean): void {
  server.tool("get_status", "Get Portainer system status", {}, async () => {
    try {
      const result = await client().get("/api/system/status");
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("get_settings", "Get Portainer settings", {}, async () => {
    try {
      const result = await client().get("/api/settings");
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
        const status = await client().get("/api/system/status");
        health.portainer = { status: "healthy", details: status };
      } catch (e) {
        health.portainer = { status: "unhealthy", error: e instanceof Error ? e.message : String(e) };
      }

      // Check environments
      try {
        const endpoints = await client().get("/api/endpoints") as Array<Record<string, unknown>>;
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
              await client().get(client().dockerPath(ep.Id as number, "/_ping"));
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

  server.tool("get_events", "Get Docker events from an environment (bounded time range)", {
    endpointId: z.number().describe("Environment/endpoint ID"),
    since: z.string().optional().describe("Show events since timestamp (Unix timestamp or RFC3339, default: 5 minutes ago)"),
    until: z.string().optional().describe("Show events until timestamp (Unix timestamp or RFC3339, default: now)"),
    type: z.enum(["container", "image", "volume", "network", "daemon", "plugin", "node", "service", "secret", "config"]).optional().describe("Filter by event type"),
    limit: z.number().optional().describe("Max events to return (default 100)"),
  }, async (args) => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const query: Record<string, string> = {
        since: args.since || String(now - 300),
        until: args.until || String(now),
      };
      if (args.type) {
        query.filters = JSON.stringify({ type: [args.type] });
      }
      const result = await client().get(client().dockerPath(args.endpointId, "/events"), query);
      // Events API returns newline-delimited JSON
      const text = String(result);
      if (!text.trim()) {
        return jsonResponse({ events: [], total: 0 });
      }
      const events = text.trim().split("\n").map(line => {
        try { return JSON.parse(line); } catch { return { raw: line }; }
      });
      const limited = events.slice(0, args.limit || 100);
      return jsonResponse({ events: limited, total: events.length });
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("get_environment_stats", "Get aggregated resource usage across all containers in an environment", {
    endpointId: z.number().describe("Environment/endpoint ID"),
  }, async (args) => {
    try {
      const containers = await client().get(client().dockerPath(args.endpointId, "/containers/json")) as Array<Record<string, unknown>>;

      let totalCpu = 0;
      let totalMemUsage = 0;
      let totalMemLimit = 0;
      let totalNetRx = 0;
      let totalNetTx = 0;
      let totalBlockRead = 0;
      let totalBlockWrite = 0;
      const containerStats: Array<Record<string, unknown>> = [];
      let errors = 0;

      for (const c of containers) {
        const name = ((c.Names as string[])?.[0] || (c.Id as string).slice(0, 12)).replace(/^\//, "");
        try {
          const stats = await client().get(
            client().dockerPath(args.endpointId, `/containers/${c.Id}/stats`),
            { stream: "false" }
          ) as Record<string, unknown>;

          // CPU calculation
          const cpuStats = stats.cpu_stats as Record<string, unknown> | undefined;
          const preCpuStats = stats.precpu_stats as Record<string, unknown> | undefined;
          let cpuPercent = 0;
          if (cpuStats && preCpuStats) {
            const cpuUsage = cpuStats.cpu_usage as Record<string, unknown> | undefined;
            const preCpuUsage = preCpuStats.cpu_usage as Record<string, unknown> | undefined;
            const systemCpu = (cpuStats.system_cpu_usage as number) || 0;
            const preSystemCpu = (preCpuStats.system_cpu_usage as number) || 0;
            const cpuDelta = ((cpuUsage?.total_usage as number) || 0) - ((preCpuUsage?.total_usage as number) || 0);
            const systemDelta = systemCpu - preSystemCpu;
            const onlineCpus = (cpuStats.online_cpus as number) || 1;
            if (systemDelta > 0) {
              cpuPercent = (cpuDelta / systemDelta) * onlineCpus * 100;
            }
          }

          // Memory
          const memStats = stats.memory_stats as Record<string, unknown> | undefined;
          const memUsage = (memStats?.usage as number) || 0;
          const memLimit = (memStats?.limit as number) || 0;

          // Network
          const networks = stats.networks as Record<string, Record<string, number>> | undefined;
          let netRx = 0, netTx = 0;
          if (networks) {
            for (const iface of Object.values(networks)) {
              netRx += iface.rx_bytes || 0;
              netTx += iface.tx_bytes || 0;
            }
          }

          // Block I/O
          const blkio = stats.blkio_stats as Record<string, unknown> | undefined;
          let blockRead = 0, blockWrite = 0;
          const ioEntries = (blkio?.io_service_bytes_recursive as Array<Record<string, unknown>>) || [];
          for (const entry of ioEntries) {
            if (entry.op === "read" || entry.op === "Read") blockRead += (entry.value as number) || 0;
            if (entry.op === "write" || entry.op === "Write") blockWrite += (entry.value as number) || 0;
          }

          totalCpu += cpuPercent;
          totalMemUsage += memUsage;
          totalMemLimit += memLimit;
          totalNetRx += netRx;
          totalNetTx += netTx;
          totalBlockRead += blockRead;
          totalBlockWrite += blockWrite;

          containerStats.push({
            name,
            cpu_percent: Math.round(cpuPercent * 100) / 100,
            memory_usage_mb: Math.round(memUsage / 1024 / 1024),
            memory_limit_mb: Math.round(memLimit / 1024 / 1024),
            net_rx_mb: Math.round(netRx / 1024 / 1024 * 100) / 100,
            net_tx_mb: Math.round(netTx / 1024 / 1024 * 100) / 100,
          });
        } catch {
          errors++;
          containerStats.push({ name, error: "Failed to get stats" });
        }
      }

      return jsonResponse({
        summary: {
          container_count: containers.length,
          total_cpu_percent: Math.round(totalCpu * 100) / 100,
          total_memory_usage_mb: Math.round(totalMemUsage / 1024 / 1024),
          total_memory_limit_mb: Math.round(totalMemLimit / 1024 / 1024),
          total_net_rx_mb: Math.round(totalNetRx / 1024 / 1024 * 100) / 100,
          total_net_tx_mb: Math.round(totalNetTx / 1024 / 1024 * 100) / 100,
          total_block_read_mb: Math.round(totalBlockRead / 1024 / 1024 * 100) / 100,
          total_block_write_mb: Math.round(totalBlockWrite / 1024 / 1024 * 100) / 100,
          errors,
        },
        containers: containerStats,
      });
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("get_container_dependencies", "Analyze network connections to build a container dependency map", {
    endpointId: z.number().describe("Environment/endpoint ID"),
  }, async (args) => {
    try {
      const networks = await client().get(client().dockerPath(args.endpointId, "/networks")) as Array<Record<string, unknown>>;
      const containers = await client().get(client().dockerPath(args.endpointId, "/containers/json"), { all: "true" }) as Array<Record<string, unknown>>;

      // Build container name map
      const idToName = new Map<string, string>();
      for (const c of containers) {
        const id = c.Id as string;
        const name = ((c.Names as string[])?.[0] || id.slice(0, 12)).replace(/^\//, "");
        idToName.set(id, name);
      }

      // Build network membership
      const networkMap: Record<string, { network: string; containers: string[] }> = {};
      for (const net of networks) {
        const netName = net.Name as string;
        const netContainers = net.Containers as Record<string, Record<string, unknown>> | undefined;
        if (!netContainers) continue;

        const members: string[] = [];
        for (const [cId, info] of Object.entries(netContainers)) {
          const name = idToName.get(cId) || (info.Name as string) || cId.slice(0, 12);
          members.push(name);
        }
        if (members.length > 0) {
          networkMap[netName] = { network: netName, containers: members };
        }
      }

      // Build adjacency: containers on the same network can communicate
      const edges: Array<{ from: string; to: string; network: string }> = [];
      for (const [netName, info] of Object.entries(networkMap)) {
        const members = info.containers;
        for (let i = 0; i < members.length; i++) {
          for (let j = i + 1; j < members.length; j++) {
            edges.push({ from: members[i], to: members[j], network: netName });
          }
        }
      }

      // Build per-container link info from container inspect (links, depends_on visible as labels)
      const containerLinks: Record<string, string[]> = {};
      for (const c of containers) {
        const name = idToName.get(c.Id as string) || (c.Id as string).slice(0, 12);
        const hostConfig = c.HostConfig as Record<string, unknown> | undefined;
        const links = (hostConfig?.Links as string[]) || [];
        if (links.length > 0) {
          containerLinks[name] = links.map(l => l.split(":")[0].replace(/^\//, ""));
        }
      }

      return jsonResponse({
        networks: networkMap,
        connections: edges,
        links: containerLinks,
        container_count: containers.length,
        network_count: Object.keys(networkMap).length,
      });
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("search_all_logs", "Search logs across all containers in an environment", {
    endpointId: z.number().describe("Environment/endpoint ID"),
    query: z.string().describe("Search string (case-insensitive)"),
    tail: z.string().optional().describe("Lines per container to search (default '100')"),
    namePattern: z.string().optional().describe("Only search containers matching this name regex"),
  }, async (args) => {
    try {
      const containers = await client().get(client().dockerPath(args.endpointId, "/containers/json")) as Array<Record<string, unknown>>;

      let targets = containers;
      if (args.namePattern) {
        const re = new RegExp(args.namePattern, "i");
        targets = targets.filter(c => {
          const names = c.Names as string[] | undefined;
          return names?.some(n => re.test(n));
        });
      }

      const results: Array<{ container: string; matches: string[] }> = [];
      const queryLower = args.query.toLowerCase();
      let totalMatches = 0;

      for (const c of targets) {
        const name = ((c.Names as string[])?.[0] || (c.Id as string).slice(0, 12)).replace(/^\//, "");
        try {
          const logQuery: Record<string, string> = {
            follow: "false",
            stdout: "true",
            stderr: "true",
            tail: args.tail || "100",
          };
          const logs = await client().get(
            client().dockerPath(args.endpointId, `/containers/${c.Id}/logs`),
            logQuery
          );
          const text = String(logs);
          const matches = text.split("\n").filter(line => line.toLowerCase().includes(queryLower));
          if (matches.length > 0) {
            results.push({ container: name, matches });
            totalMatches += matches.length;
          }
        } catch {
          // Skip containers that fail (e.g. no logs available)
        }
      }

      return jsonResponse({
        query: args.query,
        containers_searched: targets.length,
        containers_with_matches: results.length,
        total_matches: totalMatches,
        results,
      });
    } catch (e) {
      return errorResponse(e);
    }
  });

  server.tool("get_activity_logs", "Get Portainer activity/audit logs", {
    limit: z.number().optional().describe("Max entries to return (default 50)"),
    offset: z.number().optional().describe("Entries to skip"),
  }, async (args) => {
    try {
      // Portainer stores audit logs at /api/audit or /api/users/admin/activity
      // Try the standard endpoints
      let result: unknown;
      try {
        result = await client().get("/api/audit", {
          limit: String(args.limit || 50),
          start: String(args.offset || 0),
        });
      } catch {
        // Fallback: try Portainer CE endpoint
        try {
          result = await client().get("/api/endpoints");
          // If audit isn't available, return a helpful message
          return jsonResponse({
            available: false,
            message: "Activity logs require Portainer Business Edition. Use get_events for Docker-level event history instead.",
          });
        } catch (e2) {
          throw e2;
        }
      }
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  });
}
