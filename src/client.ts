export class PortainerClient {
  private baseUrl: string;
  private token: string;
  private timeout: number;
  private skipTlsVerify: boolean;

  constructor(baseUrl: string, token: string, skipTlsVerify: boolean, timeout: number = 30000) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.timeout = timeout;
    this.skipTlsVerify = skipTlsVerify;
  }

  dockerPath(endpointId: number, path: string): string {
    return `/api/endpoints/${endpointId}/docker${path}`;
  }

  private async request(method: string, path: string, body?: unknown, query?: Record<string, string>): Promise<unknown> {
    let url = `${this.baseUrl}${path}`;
    if (query) {
      const params = new URLSearchParams(query);
      url += `?${params.toString()}`;
    }

    const headers: Record<string, string> = {
      "X-API-Key": this.token,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    const init: RequestInit = { method, headers, signal: controller.signal };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    // Scope TLS bypass to this request instead of setting it globally
    const prevTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    if (this.skipTlsVerify) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    try {
      const response = await fetch(url, init);

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Portainer API error ${response.status}: ${text}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return response.json();
      }
      return response.text();
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new Error(`Request timed out after ${this.timeout}ms: ${method} ${path}`);
      }
      throw e;
    } finally {
      clearTimeout(timer);
      if (this.skipTlsVerify) {
        if (prevTls === undefined) {
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        } else {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTls;
        }
      }
    }
  }

  async get(path: string, query?: Record<string, string>): Promise<unknown> {
    return this.request("GET", path, undefined, query);
  }

  async post(path: string, body?: unknown, query?: Record<string, string>): Promise<unknown> {
    return this.request("POST", path, body, query);
  }

  async put(path: string, body?: unknown, query?: Record<string, string>): Promise<unknown> {
    return this.request("PUT", path, body, query);
  }

  async delete(path: string, query?: Record<string, string>): Promise<unknown> {
    return this.request("DELETE", path, undefined, query);
  }
}

/**
 * A function that returns the currently active PortainerClient.
 * Used by tool registrations so they resolve the client at call time,
 * enabling runtime instance switching.
 */
export type ClientAccessor = () => PortainerClient;
