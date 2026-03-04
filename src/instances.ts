import { PortainerClient } from "./client.js";

export interface InstanceInfo {
  name: string;
  url: string;
  token: string;
  skipTlsVerify: boolean;
  timeout: number;
}

export class InstanceManager {
  private instances = new Map<string, InstanceInfo>();
  private clients = new Map<string, PortainerClient>();
  private activeName: string;

  constructor(defaultInfo: InstanceInfo) {
    this.add(defaultInfo);
    this.activeName = defaultInfo.name;
  }

  add(info: InstanceInfo): void {
    this.instances.set(info.name, info);
    this.clients.set(
      info.name,
      new PortainerClient(info.url, info.token, info.skipTlsVerify, info.timeout)
    );
  }

  remove(name: string): boolean {
    if (name === this.activeName) {
      return false; // Can't remove active instance
    }
    this.instances.delete(name);
    this.clients.delete(name);
    return true;
  }

  switch(name: string): boolean {
    if (!this.instances.has(name)) {
      return false;
    }
    this.activeName = name;
    return true;
  }

  getActive(): PortainerClient {
    return this.clients.get(this.activeName)!;
  }

  getActiveName(): string {
    return this.activeName;
  }

  getActiveInfo(): InstanceInfo {
    return this.instances.get(this.activeName)!;
  }

  list(): Array<{ name: string; url: string; active: boolean }> {
    return Array.from(this.instances.entries()).map(([name, info]) => ({
      name,
      url: info.url,
      active: name === this.activeName,
    }));
  }

  has(name: string): boolean {
    return this.instances.has(name);
  }

  getClient(name: string): PortainerClient | undefined {
    return this.clients.get(name);
  }
}
