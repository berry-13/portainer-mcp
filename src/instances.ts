import { PortainerClient } from "./client.js";

/** Connection details for a registered Portainer instance. */
export interface InstanceInfo {
  /** Display name for this instance */
  name: string;
  /** Base URL of the Portainer server */
  url: string;
  /** API token for authentication */
  token: string;
  /** Whether to skip TLS certificate verification */
  skipTlsVerify: boolean;
  /** Request timeout in milliseconds */
  timeout: number;
}

/**
 * Manages multiple Portainer instances and tracks which one is currently active.
 * Allows runtime switching between instances without restarting the server.
 */
export class InstanceManager {
  private instances = new Map<string, InstanceInfo>();
  private clients = new Map<string, PortainerClient>();
  private activeName: string;

  /**
   * Creates a new InstanceManager with a default instance.
   * @param defaultInfo - Connection info for the initial active instance
   */
  constructor(defaultInfo: InstanceInfo) {
    this.add(defaultInfo);
    this.activeName = defaultInfo.name;
  }

  /**
   * Registers a new Portainer instance.
   * @param info - Connection details for the instance
   */
  add(info: InstanceInfo): void {
    this.instances.set(info.name, info);
    this.clients.set(
      info.name,
      new PortainerClient(info.url, info.token, info.skipTlsVerify, info.timeout)
    );
  }

  /**
   * Removes a registered instance. The currently active instance cannot be removed.
   * @param name - Name of the instance to remove
   * @returns true if removed, false if the instance is active and cannot be removed
   */
  remove(name: string): boolean {
    if (name === this.activeName) {
      return false; // Can't remove active instance
    }
    this.instances.delete(name);
    this.clients.delete(name);
    return true;
  }

  /**
   * Switches the active instance to the one with the given name.
   * @param name - Name of the instance to activate
   * @returns true if switched successfully, false if the instance does not exist
   */
  switch(name: string): boolean {
    if (!this.instances.has(name)) {
      return false;
    }
    this.activeName = name;
    return true;
  }

  /**
   * Returns the PortainerClient for the currently active instance.
   * @returns The active client
   * @throws Error if the active instance is not found (should not happen)
   */
  getActive(): PortainerClient {
    const client = this.clients.get(this.activeName);
    if (!client) {
      throw new Error(`Active instance '${this.activeName}' not found. This should not happen.`);
    }
    return client;
  }

  /** Returns the name of the currently active instance. */
  getActiveName(): string {
    return this.activeName;
  }

  /**
   * Returns the connection info for the currently active instance.
   * @returns The active instance's connection details
   * @throws Error if the active instance is not found (should not happen)
   */
  getActiveInfo(): InstanceInfo {
    const info = this.instances.get(this.activeName);
    if (!info) {
      throw new Error(`Active instance '${this.activeName}' not found. This should not happen.`);
    }
    return info;
  }

  /**
   * Lists all registered instances with their active status.
   * @returns Array of instance summaries
   */
  list(): Array<{ name: string; url: string; active: boolean }> {
    return Array.from(this.instances.entries()).map(([name, info]) => ({
      name,
      url: info.url,
      active: name === this.activeName,
    }));
  }

  /**
   * Checks whether an instance with the given name is registered.
   * @param name - Instance name to look up
   * @returns true if the instance exists
   */
  has(name: string): boolean {
    return this.instances.has(name);
  }

  /**
   * Returns the PortainerClient for a specific instance by name.
   * @param name - Instance name to look up
   * @returns The client, or undefined if the instance does not exist
   */
  getClient(name: string): PortainerClient | undefined {
    return this.clients.get(name);
  }
}
