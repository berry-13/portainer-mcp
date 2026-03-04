<p align="center">
  <img src="https://raw.githubusercontent.com/portainer/portainer/develop/app/assets/images/portainer-logo.svg" alt="Portainer" width="80" />
  <br/>
  <strong style="font-size: 2em;">portainer-mcp</strong>
  <br/>
  <em>The complete MCP server for Portainer &mdash; 112 tools, zero version lock-in.</em>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#tools">Tools</a> &bull;
  <a href="#multi-instance">Multi-Instance</a> &bull;
  <a href="#transports">Transports</a> &bull;
  <a href="#docker">Docker</a> &bull;
  <a href="#configuration">Configuration</a>
</p>

---

## Why?

The official Portainer MCP server is locked to v2.31.2 and crashes on newer versions. It only covers ~40 tools focused on stacks and teams.

**This is a full rebuild from scratch:**

- **112 tools** covering every Docker and Portainer API surface
- **Works with any Portainer version** &mdash; no hardcoded version checks
- **Multi-instance** &mdash; manage multiple Portainer servers from one MCP
- **Dual transport** &mdash; stdio for CLI, Streamable HTTP for remote/web
- **Read-only mode** &mdash; write tools simply don't register
- **Smart responses** &mdash; pagination, summaries, server-side log filtering

---

## Quick Start

### npx (zero install)

```bash
npx portainer-mcp --server https://your-portainer:9443 --token your-api-token --skip-tls-verify
```

### Claude Desktop / Claude Code

Add to your MCP config:

```json
{
  "mcpServers": {
    "portainer": {
      "command": "npx",
      "args": [
        "portainer-mcp",
        "--server", "https://your-portainer:9443",
        "--token", "your-api-token",
        "--skip-tls-verify"
      ]
    }
  }
}
```

### Environment Variables

```bash
export PORTAINER_URL="https://your-portainer:9443"
export PORTAINER_TOKEN="your-api-token"
export PORTAINER_SKIP_TLS_VERIFY="true"
npx portainer-mcp
```

---

## Tools

### Containers &mdash; 25 tools

| Tool | Type | Description |
|------|------|-------------|
| `list_containers` | read | List containers with pagination & summary mode |
| `inspect_container` | read | Inspect with smart field filtering |
| `container_logs` | read | Logs with server-side grep filtering |
| `container_stats` | read | CPU, memory, network, I/O snapshot |
| `container_processes` | read | Running processes inside a container |
| `read_file_from_container` | read | Read any file from inside a container |
| `list_files_in_container` | read | Browse directories inside a container |
| `diff_container` | read | Filesystem changes since creation |
| `create_container` | write | Full container creation with all Docker options |
| `start_container` | write | Start a stopped container |
| `stop_container` | write | Graceful stop with configurable timeout |
| `restart_container` | write | Restart with configurable timeout |
| `remove_container` | write | Remove with force and volume options |
| `kill_container` | write | Send signals to a container |
| `pause_container` | write | Freeze a running container |
| `unpause_container` | write | Resume a paused container |
| `rename_container` | write | Rename a container |
| `exec_container` | write | Execute commands inside a container |
| `write_file_to_container` | write | Write content to a file inside a container |
| `bulk_start_containers` | write | Start containers by name pattern or label |
| `bulk_stop_containers` | write | Stop containers by name pattern or label |
| `bulk_restart_containers` | write | Restart containers by name pattern or label |

### Images &mdash; 12 tools

| Tool | Type | Description |
|------|------|-------------|
| `list_images` | read | List with pagination & summary mode |
| `inspect_image` | read | Inspect with smart field filtering |
| `image_history` | read | Layer history of an image |
| `search_images` | read | Search Docker Hub |
| `inspect_image_security` | read | Security analysis: USER, ports, env secrets |
| `get_image_vulnerabilities` | read | Vulnerability scan results (BE) |
| `pull_image` | write | Pull from any registry |
| `remove_image` | write | Remove with force/noprune options |
| `tag_image` | write | Tag an image |
| `prune_images` | write | Clean up unused images |

### Stacks &mdash; 12 tools

| Tool | Type | Description |
|------|------|-------------|
| `list_stacks` | read | List all stacks with pagination |
| `get_stack` | read | Stack details |
| `get_stack_file` | read | Get the compose file content |
| `validate_compose` | read | Validate compose YAML without deploying |
| `diff_stack` | read | Diff current vs proposed compose file |
| `create_stack` | write | Deploy from compose string (with validation) |
| `update_stack` | write | Update with compose string (with validation) |
| `delete_stack` | write | Delete a stack |
| `start_stack` | write | Start a stopped stack |
| `stop_stack` | write | Stop a running stack |
| `recreate_stack` | write | Pull + redeploy in one operation |
| `rollback_stack` | write | Rollback to previous compose content |

### Networks &mdash; 8 tools

| Tool | Type | Description |
|------|------|-------------|
| `list_networks` | read | List all networks with pagination |
| `inspect_network` | read | Network details and connected containers |
| `create_network` | write | Create with driver, IPAM, labels |
| `remove_network` | write | Remove a network |
| `connect_network` | write | Attach a container to a network |
| `disconnect_network` | write | Detach a container from a network |
| `prune_networks` | write | Clean up unused networks |

### Volumes &mdash; 6 tools

| Tool | Type | Description |
|------|------|-------------|
| `list_volumes` | read | List all volumes with pagination |
| `inspect_volume` | read | Volume details |
| `create_volume` | write | Create with driver and options |
| `remove_volume` | write | Remove with force option |
| `prune_volumes` | write | Clean up unused volumes |

### System & Monitoring &mdash; 8 tools

| Tool | Type | Description |
|------|------|-------------|
| `get_status` | read | Portainer system status |
| `get_settings` | read | Portainer settings |
| `health_check` | read | Full health check: Portainer + all environments |
| `get_events` | read | Docker events with time range & type filtering |
| `get_environment_stats` | read | Aggregated CPU/memory/IO across all containers |
| `get_container_dependencies` | read | Network-based container dependency graph |
| `search_all_logs` | read | Search logs across all containers |
| `get_activity_logs` | read | Portainer audit trail (Business Edition) |

### Environments &mdash; 5 tools

| Tool | Type | Description |
|------|------|-------------|
| `list_environments` | read | List all environments with pagination |
| `get_environment` | read | Environment details |
| `create_environment` | write | Create a new environment |
| `update_environment` | write | Update environment settings |
| `delete_environment` | write | Delete an environment |

### Teams &mdash; 9 tools

| Tool | Type | Description |
|------|------|-------------|
| `list_teams` | read | List all teams |
| `get_team` | read | Team details |
| `list_team_members` | read | Team membership |
| `create_team` | write | Create a team |
| `update_team` | write | Update a team |
| `delete_team` | write | Delete a team |
| `add_team_member` | write | Add user to team |
| `remove_team_member` | write | Remove user from team |

### Users &mdash; 5 tools &bull; Registries &mdash; 5 tools &bull; Templates &mdash; 6 tools &bull; Tags &mdash; 3 tools &bull; Webhooks &mdash; 3 tools

Full CRUD for users, registries, custom templates, tags, and webhooks. All list endpoints support pagination.

### Instance Management &mdash; 4 tools

| Tool | Type | Description |
|------|------|-------------|
| `list_instances` | read | Show all configured Portainer instances |
| `switch_instance` | write | Switch the active instance |
| `add_instance` | write | Add a new instance at runtime |
| `remove_instance` | write | Remove a non-active instance |

---

## Multi-Instance

Manage multiple Portainer servers from a single MCP session.

### At startup

```bash
npx portainer-mcp \
  --server https://prod:9443 --token prod-token \
  --instances '[
    {"name": "staging", "url": "https://staging:9443", "token": "staging-token"},
    {"name": "dev", "url": "https://dev:9443", "token": "dev-token", "skipTlsVerify": true}
  ]'
```

### At runtime

```
> list_instances
  [{ name: "default", url: "https://prod:9443", active: true },
   { name: "staging", url: "https://staging:9443", active: false }]

> switch_instance({ name: "staging" })
  { success: true, active: "staging" }

> add_instance({ name: "test", url: "https://test:9443", token: "..." })
```

All tools automatically use the active instance. Switch anytime.

---

## Transports

### stdio (default)

Standard MCP transport for CLI tools like Claude Code:

```bash
npx portainer-mcp --server https://portainer:9443 --token xxx
```

### Streamable HTTP

For remote access, web clients, or multi-client setups:

```bash
npx portainer-mcp \
  --server https://portainer:9443 \
  --token xxx \
  --transport http \
  --port 3000
```

Starts a server at `http://localhost:3000/mcp` supporting:
- `POST /mcp` &mdash; JSON-RPC requests
- `GET /mcp` &mdash; SSE notification stream
- `DELETE /mcp` &mdash; Session termination
- Full CORS headers for browser clients
- Session management with auto-generated IDs

---

## Docker

### Build

```bash
docker build -t portainer-mcp .
```

### Run (stdio)

```bash
docker run --rm -i portainer-mcp \
  --server https://portainer:9443 \
  --token your-token \
  --skip-tls-verify
```

### Run (HTTP)

```bash
docker run --rm -p 3000:3000 portainer-mcp \
  --server https://portainer:9443 \
  --token your-token \
  --transport http \
  --port 3000
```

### Docker Compose

```yaml
services:
  portainer-mcp:
    build: .
    ports:
      - "3000:3000"
    environment:
      PORTAINER_URL: https://portainer:9443
      PORTAINER_TOKEN: your-token
      PORTAINER_TRANSPORT: http
      PORTAINER_SKIP_TLS_VERIFY: "true"
```

---

## Configuration

| Flag | Env Var | Default | Description |
|------|---------|---------|-------------|
| `--server` | `PORTAINER_URL` | *required* | Portainer server URL |
| `--token` | `PORTAINER_TOKEN` | *required* | API token |
| `--read-only` | `PORTAINER_READ_ONLY` | `false` | Hide all write tools |
| `--skip-tls-verify` | `PORTAINER_SKIP_TLS_VERIFY` | `false` | Skip TLS cert verification |
| `--timeout` | `PORTAINER_TIMEOUT` | `30000` | Request timeout (ms) |
| `--transport` | `PORTAINER_TRANSPORT` | `stdio` | Transport: `stdio` or `http` |
| `--port` | `PORTAINER_PORT` | `3000` | HTTP server port |
| `--instances` | `PORTAINER_INSTANCES` | `[]` | Additional instances (JSON) |

CLI flags take precedence over environment variables.

---

## MCP Resources

Five resources are exposed as context for MCP clients:

| URI | Description |
|-----|-------------|
| `portainer://system/status` | System status |
| `portainer://environments` | All environments |
| `portainer://environments/{id}` | Specific environment details |
| `portainer://environments/{id}/containers` | Containers in an environment |
| `portainer://stacks` | All stacks |

---

## Read-Only Mode

```bash
npx portainer-mcp --server ... --token ... --read-only
```

When enabled, all write/delete tools are **not registered** &mdash; they don't show up in `listTools` at all. This is a hard gate, not a soft warning. Safe for monitoring-only access.

**Read-only tools available:** 47
**Write tools hidden:** 65

---

## Smart Responses

### Pagination

All list endpoints accept `limit` and `offset`:

```json
{ "endpointId": 1, "limit": 10, "offset": 20 }
```

Returns:
```json
{ "data": [...], "total": 150, "offset": 20, "limit": 10 }
```

### Summary Mode

`list_containers`, `inspect_container`, `list_images`, and `inspect_image` return concise summaries by default. Pass `full: true` for the complete Docker API response.

### Log Filtering

```json
{ "endpointId": 1, "id": "my-app", "filter": "ERROR", "tail": "500" }
```

Searches logs server-side before returning &mdash; no wasted tokens on irrelevant lines.

---

## Architecture

```
src/
  index.ts            Entry point: CLI parse -> transport setup
  config.ts           CLI/env config with multi-instance support
  client.ts           PortainerClient + ClientAccessor pattern
  instances.ts        InstanceManager for multi-server support
  server.ts           McpServer factory wiring tools + resources
  resources.ts        MCP Resources (5 resources)
  tools/
    index.ts           Orchestrator: registers all 13 tool modules
    system.ts          Status, health, events, stats, deps, logs (8)
    containers.ts      Full container lifecycle + file ops (25)
    images.ts          Image management + security analysis (12)
    stacks.ts          Stack lifecycle + diff + rollback (12)
    networks.ts        Network management (8)
    volumes.ts         Volume management (6)
    environments.ts    Environment CRUD (5)
    registries.ts      Registry CRUD (5)
    users.ts           User CRUD (5)
    teams.ts           Team + membership management (9)
    templates.ts       Template management (6)
    tags.ts            Tag management (3)
    webhooks.ts        Webhook management (3)
    instances.ts       Multi-instance management (4)
  utils/
    response.ts        JSON/text/error/paginated response helpers
    filters.ts         Container & image summary extractors
    compose.ts         Docker Compose YAML validator
    diff.ts            Line & service-level compose differ
```

---

## Tech Stack

- **TypeScript** with `@modelcontextprotocol/sdk` + `zod`
- **Node 20** built-in `fetch` &mdash; zero HTTP dependencies
- **stdio** + **Streamable HTTP** transports
- **Multi-stage Docker** build on `node:20-alpine`

---

## License

MIT
