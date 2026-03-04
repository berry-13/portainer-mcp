import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { parseConfig } from "../config.js";

describe("parseConfig", () => {
  const originalArgv = process.argv;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset to clean state before each test
    process.argv = ["node", "index.js"];
    // Clear all relevant env vars
    delete process.env.PORTAINER_URL;
    delete process.env.PORTAINER_TOKEN;
    delete process.env.PORTAINER_READ_ONLY;
    delete process.env.PORTAINER_SKIP_TLS_VERIFY;
    delete process.env.PORTAINER_TIMEOUT;
    delete process.env.PORTAINER_TRANSPORT;
    delete process.env.PORTAINER_PORT;
    delete process.env.PORTAINER_INSTANCES;
  });

  afterEach(() => {
    process.argv = originalArgv;
    // Restore original env vars
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("PORTAINER_") && !(key in originalEnv)) {
        delete process.env[key];
      }
    }
    for (const [key, val] of Object.entries(originalEnv)) {
      if (key.startsWith("PORTAINER_")) {
        process.env[key] = val;
      }
    }
    vi.restoreAllMocks();
  });

  it("parses server and token from CLI args", () => {
    process.argv = ["node", "index.js", "--server", "https://portainer.example.com", "--token", "my-secret-token"];
    const config = parseConfig();
    expect(config.server).toBe("https://portainer.example.com");
    expect(config.token).toBe("my-secret-token");
  });

  it("parses server and token from environment variables", () => {
    process.env.PORTAINER_URL = "https://env.example.com";
    process.env.PORTAINER_TOKEN = "env-token";
    const config = parseConfig();
    expect(config.server).toBe("https://env.example.com");
    expect(config.token).toBe("env-token");
  });

  it("CLI args take precedence over environment variables", () => {
    process.env.PORTAINER_URL = "https://env.example.com";
    process.env.PORTAINER_TOKEN = "env-token";
    process.argv = ["node", "index.js", "--server", "https://cli.example.com", "--token", "cli-token"];
    const config = parseConfig();
    expect(config.server).toBe("https://cli.example.com");
    expect(config.token).toBe("cli-token");
  });

  it("exits when server is missing", () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);
    const mockError = vi.spyOn(console, "error").mockImplementation(() => {});

    process.env.PORTAINER_TOKEN = "some-token";

    expect(() => parseConfig()).toThrow("process.exit called");
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockError).toHaveBeenCalledWith("Error: --server or PORTAINER_URL is required");
  });

  it("exits when token is missing", () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);
    const mockError = vi.spyOn(console, "error").mockImplementation(() => {});

    process.env.PORTAINER_URL = "https://example.com";

    expect(() => parseConfig()).toThrow("process.exit called");
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockError).toHaveBeenCalledWith("Error: --token or PORTAINER_TOKEN is required");
  });

  it("parses --read-only flag from CLI", () => {
    process.argv = ["node", "index.js", "--server", "https://example.com", "--token", "tok", "--read-only"];
    const config = parseConfig();
    expect(config.readOnly).toBe(true);
  });

  it("defaults read-only to false", () => {
    process.argv = ["node", "index.js", "--server", "https://example.com", "--token", "tok"];
    const config = parseConfig();
    expect(config.readOnly).toBe(false);
  });

  it("parses PORTAINER_READ_ONLY env var", () => {
    process.env.PORTAINER_URL = "https://example.com";
    process.env.PORTAINER_TOKEN = "tok";
    process.env.PORTAINER_READ_ONLY = "true";
    const config = parseConfig();
    expect(config.readOnly).toBe(true);
  });

  it("parses --skip-tls-verify flag from CLI", () => {
    process.argv = ["node", "index.js", "--server", "https://example.com", "--token", "tok", "--skip-tls-verify"];
    const config = parseConfig();
    expect(config.skipTlsVerify).toBe(true);
  });

  it("parses PORTAINER_SKIP_TLS_VERIFY env var", () => {
    process.env.PORTAINER_URL = "https://example.com";
    process.env.PORTAINER_TOKEN = "tok";
    process.env.PORTAINER_SKIP_TLS_VERIFY = "true";
    const config = parseConfig();
    expect(config.skipTlsVerify).toBe(true);
  });

  it("parses --timeout from CLI args", () => {
    process.argv = ["node", "index.js", "--server", "https://example.com", "--token", "tok", "--timeout", "5000"];
    const config = parseConfig();
    expect(config.timeout).toBe(5000);
  });

  it("defaults timeout to 30000 when not specified", () => {
    process.argv = ["node", "index.js", "--server", "https://example.com", "--token", "tok"];
    const config = parseConfig();
    expect(config.timeout).toBe(30000);
  });

  it("ignores NaN timeout from CLI", () => {
    process.argv = ["node", "index.js", "--server", "https://example.com", "--token", "tok", "--timeout", "not-a-number"];
    const config = parseConfig();
    expect(config.timeout).toBe(30000); // Falls back to default
  });

  it("ignores NaN timeout from env var", () => {
    process.env.PORTAINER_URL = "https://example.com";
    process.env.PORTAINER_TOKEN = "tok";
    process.env.PORTAINER_TIMEOUT = "abc";
    const config = parseConfig();
    expect(config.timeout).toBe(30000);
  });

  it("parses --port from CLI args", () => {
    process.argv = ["node", "index.js", "--server", "https://example.com", "--token", "tok", "--port", "8080"];
    const config = parseConfig();
    expect(config.port).toBe(8080);
  });

  it("defaults port to 3000 when not specified", () => {
    process.argv = ["node", "index.js", "--server", "https://example.com", "--token", "tok"];
    const config = parseConfig();
    expect(config.port).toBe(3000);
  });

  it("ignores NaN port from CLI", () => {
    process.argv = ["node", "index.js", "--server", "https://example.com", "--token", "tok", "--port", "notaport"];
    const config = parseConfig();
    expect(config.port).toBe(3000);
  });

  it("parses --transport from CLI args", () => {
    process.argv = ["node", "index.js", "--server", "https://example.com", "--token", "tok", "--transport", "http"];
    const config = parseConfig();
    expect(config.transport).toBe("http");
  });

  it("defaults transport to stdio", () => {
    process.argv = ["node", "index.js", "--server", "https://example.com", "--token", "tok"];
    const config = parseConfig();
    expect(config.transport).toBe("stdio");
  });

  it("parses PORTAINER_TRANSPORT env var", () => {
    process.env.PORTAINER_URL = "https://example.com";
    process.env.PORTAINER_TOKEN = "tok";
    process.env.PORTAINER_TRANSPORT = "http";
    const config = parseConfig();
    expect(config.transport).toBe("http");
  });

  it("removes trailing slashes from server URL", () => {
    process.argv = ["node", "index.js", "--server", "https://example.com///", "--token", "tok"];
    const config = parseConfig();
    expect(config.server).toBe("https://example.com");
  });

  it("parses --instances JSON from CLI args", () => {
    const instances = [
      { name: "prod", url: "https://prod.example.com", token: "prod-token" },
      { name: "dev", url: "https://dev.example.com", token: "dev-token" },
    ];
    process.argv = [
      "node",
      "index.js",
      "--server",
      "https://example.com",
      "--token",
      "tok",
      "--instances",
      JSON.stringify(instances),
    ];
    const config = parseConfig();
    expect(config.instances).toHaveLength(2);
    expect(config.instances[0].name).toBe("prod");
    expect(config.instances[1].name).toBe("dev");
  });

  it("parses PORTAINER_INSTANCES env var", () => {
    process.env.PORTAINER_URL = "https://example.com";
    process.env.PORTAINER_TOKEN = "tok";
    process.env.PORTAINER_INSTANCES = JSON.stringify([
      { name: "staging", url: "https://staging.example.com", token: "stag-tok" },
    ]);
    const config = parseConfig();
    expect(config.instances).toHaveLength(1);
    expect(config.instances[0].name).toBe("staging");
  });

  it("exits on invalid instances JSON", () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);
    const mockError = vi.spyOn(console, "error").mockImplementation(() => {});

    process.argv = [
      "node",
      "index.js",
      "--server",
      "https://example.com",
      "--token",
      "tok",
      "--instances",
      "not-valid-json",
    ];

    expect(() => parseConfig()).toThrow("process.exit called");
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockError).toHaveBeenCalledWith("Error: --instances must be valid JSON array");
  });

  it("returns empty instances array when not specified", () => {
    process.argv = ["node", "index.js", "--server", "https://example.com", "--token", "tok"];
    const config = parseConfig();
    expect(config.instances).toEqual([]);
  });

  it("parses PORTAINER_PORT env var", () => {
    process.env.PORTAINER_URL = "https://example.com";
    process.env.PORTAINER_TOKEN = "tok";
    process.env.PORTAINER_PORT = "9090";
    const config = parseConfig();
    expect(config.port).toBe(9090);
  });

  it("parses PORTAINER_TIMEOUT env var", () => {
    process.env.PORTAINER_URL = "https://example.com";
    process.env.PORTAINER_TOKEN = "tok";
    process.env.PORTAINER_TIMEOUT = "60000";
    const config = parseConfig();
    expect(config.timeout).toBe(60000);
  });
});
