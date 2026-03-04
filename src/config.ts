export type TransportType = "stdio" | "http";

export interface InstanceConfig {
  name: string;
  url: string;
  token: string;
  skipTlsVerify?: boolean;
  timeout?: number;
}

export interface Config {
  server: string;
  token: string;
  readOnly: boolean;
  skipTlsVerify: boolean;
  timeout: number;
  transport: TransportType;
  port: number;
  instances: InstanceConfig[];
}

export function parseConfig(): Config {
  const args = process.argv.slice(2);

  let server: string | undefined;
  let token: string | undefined;
  let readOnly = false;
  let skipTlsVerify = false;
  let timeout: number | undefined;
  let transport: TransportType = "stdio";
  let port: number | undefined;
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

  return { server, token, readOnly, skipTlsVerify, timeout: timeout || 30000, transport, port: port || 3000, instances };
}
