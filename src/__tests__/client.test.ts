import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PortainerClient } from "../client.js";

describe("PortainerClient", () => {
  describe("dockerPath", () => {
    it("generates correct path for containers endpoint", () => {
      const client = new PortainerClient("https://example.com", "tok", false);
      expect(client.dockerPath(1, "/containers/json")).toBe(
        "/api/endpoints/1/docker/containers/json"
      );
    });

    it("generates correct path for images endpoint", () => {
      const client = new PortainerClient("https://example.com", "tok", false);
      expect(client.dockerPath(5, "/images/json")).toBe(
        "/api/endpoints/5/docker/images/json"
      );
    });

    it("generates correct path with different endpoint IDs", () => {
      const client = new PortainerClient("https://example.com", "tok", false);
      expect(client.dockerPath(42, "/networks")).toBe(
        "/api/endpoints/42/docker/networks"
      );
    });

    it("handles nested paths", () => {
      const client = new PortainerClient("https://example.com", "tok", false);
      expect(client.dockerPath(1, "/containers/abc123/logs")).toBe(
        "/api/endpoints/1/docker/containers/abc123/logs"
      );
    });

    it("handles root path", () => {
      const client = new PortainerClient("https://example.com", "tok", false);
      expect(client.dockerPath(1, "/")).toBe("/api/endpoints/1/docker/");
    });
  });

  describe("HTTP requests", () => {
    let fetchSpy: ReturnType<typeof vi.fn>;
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("sends GET requests with correct URL and headers", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ status: "ok" }),
      });

      const client = new PortainerClient("https://portainer.test", "my-token", false, 5000);
      const result = await client.get("/api/status");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://portainer.test/api/status");
      expect(init.method).toBe("GET");
      expect(init.headers["X-API-Key"]).toBe("my-token");
      expect(result).toEqual({ status: "ok" });
    });

    it("sends POST requests with JSON body", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ id: 1 }),
      });

      const client = new PortainerClient("https://portainer.test", "tok", false);
      const body = { name: "test-stack", compose: "services:\n  web:\n    image: nginx" };
      await client.post("/api/stacks", body);

      const [, init] = fetchSpy.mock.calls[0];
      expect(init.method).toBe("POST");
      expect(init.headers["Content-Type"]).toBe("application/json");
      expect(JSON.parse(init.body)).toEqual(body);
    });

    it("sends PUT requests with JSON body", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ updated: true }),
      });

      const client = new PortainerClient("https://portainer.test", "tok", false);
      await client.put("/api/stacks/1", { name: "updated" });

      const [, init] = fetchSpy.mock.calls[0];
      expect(init.method).toBe("PUT");
      expect(init.headers["Content-Type"]).toBe("application/json");
    });

    it("sends DELETE requests without body", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({}),
      });

      const client = new PortainerClient("https://portainer.test", "tok", false);
      await client.delete("/api/stacks/1");

      const [, init] = fetchSpy.mock.calls[0];
      expect(init.method).toBe("DELETE");
      expect(init.body).toBeUndefined();
    });

    it("appends query parameters to URL", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve([]),
      });

      const client = new PortainerClient("https://portainer.test", "tok", false);
      await client.get("/api/containers/json", { all: "true", filters: '{"status":["running"]}' });

      const [url] = fetchSpy.mock.calls[0];
      expect(url).toContain("?");
      expect(url).toContain("all=true");
      expect(url).toContain("filters=");
    });

    it("returns text when content-type is not JSON", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "text/plain" }),
        text: () => Promise.resolve("plain text response"),
      });

      const client = new PortainerClient("https://portainer.test", "tok", false);
      const result = await client.get("/api/logs");
      expect(result).toBe("plain text response");
    });

    it("throws error on non-ok response with status code and body", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve("resource not found"),
      });

      const client = new PortainerClient("https://portainer.test", "tok", false);
      await expect(client.get("/api/stacks/999")).rejects.toThrow(
        "Portainer API error 404: resource not found"
      );
    });

    it("throws error on non-ok response even when body text fails", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.reject(new Error("body read failed")),
      });

      const client = new PortainerClient("https://portainer.test", "tok", false);
      await expect(client.get("/api/stacks")).rejects.toThrow("Portainer API error 500:");
    });

    it("throws timeout error when request takes too long", async () => {
      // Mock a fetch that never resolves until signal is aborted
      fetchSpy.mockImplementation(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () => {
              const err = new DOMException("The operation was aborted.", "AbortError");
              reject(err);
            });
          })
      );

      const client = new PortainerClient("https://portainer.test", "tok", false, 50);
      await expect(client.get("/api/slow")).rejects.toThrow(/Request timed out after 50ms/);
    });
  });

  describe("TLS env var scoping", () => {
    let fetchSpy: ReturnType<typeof vi.fn>;
    const originalFetch = globalThis.fetch;
    const originalTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

    beforeEach(() => {
      fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      if (originalTls === undefined) {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      } else {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTls;
      }
    });

    it("sets NODE_TLS_REJECT_UNAUTHORIZED=0 during request when skipTlsVerify is true", async () => {
      let tlsDuringRequest: string | undefined;
      fetchSpy.mockImplementation(async () => {
        tlsDuringRequest = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        return {
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({}),
        };
      });

      const client = new PortainerClient("https://portainer.test", "tok", true);
      await client.get("/api/status");

      expect(tlsDuringRequest).toBe("0");
    });

    it("restores NODE_TLS_REJECT_UNAUTHORIZED after request when skipTlsVerify is true", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({}),
      });

      const client = new PortainerClient("https://portainer.test", "tok", true);
      await client.get("/api/status");

      // Should be restored (deleted since it was not set before)
      expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined();
    });

    it("restores previous NODE_TLS_REJECT_UNAUTHORIZED value after request", async () => {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";

      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({}),
      });

      const client = new PortainerClient("https://portainer.test", "tok", true);
      await client.get("/api/status");

      expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe("1");
    });

    it("does not touch NODE_TLS_REJECT_UNAUTHORIZED when skipTlsVerify is false", async () => {
      let tlsDuringRequest: string | undefined;
      fetchSpy.mockImplementation(async () => {
        tlsDuringRequest = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        return {
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({}),
        };
      });

      const client = new PortainerClient("https://portainer.test", "tok", false);
      await client.get("/api/status");

      expect(tlsDuringRequest).toBeUndefined();
    });

    it("restores NODE_TLS_REJECT_UNAUTHORIZED even when request fails", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("server error"),
      });

      const client = new PortainerClient("https://portainer.test", "tok", true);
      await expect(client.get("/api/broken")).rejects.toThrow();

      // Should still restore env var
      expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined();
    });
  });
});
