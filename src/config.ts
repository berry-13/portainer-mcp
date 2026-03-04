/** MCP server transport protocol. */
export type TransportType = "stdio" | "http";

/** Configuration for an additional Portainer instance in multi-instance mode. */
export interface InstanceConfig {
  /** Display name for this instance */
  name: string;
  /** Base URL of the Portainer server */
  url: string;
  /** API token for authentication */
  token: string;
  /** Whether to skip TLS certificate verification */
  skipTlsVerify?: boolean;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Application configuration parsed from CLI arguments and environment variables.
 */
export interface Config {
  /** Base URL of the primary Portainer server */
  server: string;
  /** API token for the primary Portainer server */
  token: string;
  /** When true, write operations (create, update, delete) are disabled */
  readOnly: boolean;
  /** Whether to skip TLS certificate verification */
  skipTlsVerify: boolean;
  /** Request timeout in milliseconds */
  timeout: number;
  /** MCP transport protocol */
  transport: TransportType;
  /** HTTP server port (only used when transport is "http") */
  port: number;
  /** Maximum number of requests per minute for HTTP transport */
  rateLimit: number;
  /** Additional Portainer instances for multi-instance mode */
  instances: InstanceConfig[];
}

/**
 * Parses application configuration from CLI arguments and environment variables.
 * CLI arguments take precedence over environment variables.
 * @returns The parsed configuration object
 * @throws Exits the process if required --server/--token values are missing
 */
export function parseConfig(): Config {
  const args = process.argv.slice(2);

  let server: string | undefined;
  let token: string | undefined;
  let readOnly = false;
  let skipTlsVerify = false;
  let timeout: number | undefined;
  let transport: TransportType = "stdio";
  let port: number | undefined;
  let rateLimit: number | undefined;
  let instancesJson: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--server":
        server = args[++i];
        break;
      case "--token":
        token = args[++i];
        break;
      case "--read-only":
        readOnly = true;
        break;
      case "--skip-tls-verify":
        skipTlsVerify = true;
        break;
      case "--timeout": {
        const parsed = parseInt(args[++i], 10);
        if (!isNaN(parsed)) timeout = parsed;
        break;
      }
      case "--transport":
        transport = args[++i] as TransportType;
        break;
      case "--port": {
        const parsed = parseInt(args[++i], 10);
        if (!isNaN(parsed)) port = parsed;
        break;
      }
      case "--rate-limit": {
        const parsed = parseInt(args[++i], 10);
        if (!isNaN(parsed)) rateLimit = parsed;
        break;
      }
      case "--instances":
        instancesJson = args[++i];
        break;
    }
  }

  server = server || process.env.PORTAINER_URL;
  token = token || process.env.PORTAINER_TOKEN;

  if (!readOnly && process.env.PORTAINER_READ_ONLY === "true") {
    readOnly = true;
  }
  if (!skipTlsVerify && process.env.PORTAINER_SKIP_TLS_VERIFY === "true") {
    skipTlsVerify = true;
  }
  if (timeout === undefined && process.env.PORTAINER_TIMEOUT) {
    const parsed = parseInt(process.env.PORTAINER_TIMEOUT, 10);
    if (!isNaN(parsed)) timeout = parsed;
  }
  if (transport === "stdio" && process.env.PORTAINER_TRANSPORT) {
    transport = process.env.PORTAINER_TRANSPORT as TransportType;
  }
  if (port === undefined && process.env.PORTAINER_PORT) {
    const parsed = parseInt(process.env.PORTAINER_PORT, 10);
    if (!isNaN(parsed)) port = parsed;
  }
  if (rateLimit === undefined && process.env.PORTAINER_RATE_LIMIT) {
    const parsed = parseInt(process.env.PORTAINER_RATE_LIMIT, 10);
    if (!isNaN(parsed)) rateLimit = parsed;
  }

  if (!server) {
    console.error("Error: --server or PORTAINER_URL is required");
    process.exit(1);
  }
  if (!token) {
    console.error("Error: --token or PORTAINER_TOKEN is required");
    process.exit(1);
  }

  // Remove trailing slash
  server = server.replace(/\/+$/, "");

  // Parse additional instances
  let instances: InstanceConfig[] = [];
  const rawInstances = instancesJson || process.env.PORTAINER_INSTANCES;
  if (rawInstances) {
    try {
      instances = JSON.parse(rawInstances);
    } catch {
      console.error("Error: --instances must be valid JSON array");
      process.exit(1);
    }
  }

  return { server, token, readOnly, skipTlsVerify, timeout: timeout || 30000, transport, port: port || 3000, rateLimit: rateLimit || 100, instances };
}
