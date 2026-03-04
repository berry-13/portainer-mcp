import { describe, it, expect } from "vitest";
import { InstanceManager, type InstanceInfo } from "../instances.js";

function makeInstance(name: string, url?: string): InstanceInfo {
  return {
    name,
    url: url || `https://${name}.example.com`,
    token: `${name}-token`,
    skipTlsVerify: false,
    timeout: 30000,
  };
}

describe("InstanceManager", () => {
  it("creates a default instance in the constructor", () => {
    const mgr = new InstanceManager(makeInstance("default"));
    expect(mgr.has("default")).toBe(true);
    expect(mgr.getActiveName()).toBe("default");
  });

  it("sets the default instance as active", () => {
    const mgr = new InstanceManager(makeInstance("primary"));
    expect(mgr.getActiveName()).toBe("primary");
    const client = mgr.getActive();
    expect(client).toBeDefined();
  });

  it("adds a new instance", () => {
    const mgr = new InstanceManager(makeInstance("default"));
    mgr.add(makeInstance("secondary"));
    expect(mgr.has("secondary")).toBe(true);
  });

  it("removes a non-active instance", () => {
    const mgr = new InstanceManager(makeInstance("default"));
    mgr.add(makeInstance("secondary"));
    const removed = mgr.remove("secondary");
    expect(removed).toBe(true);
    expect(mgr.has("secondary")).toBe(false);
  });

  it("cannot remove the active instance", () => {
    const mgr = new InstanceManager(makeInstance("default"));
    mgr.add(makeInstance("secondary"));
    const removed = mgr.remove("default");
    expect(removed).toBe(false);
    expect(mgr.has("default")).toBe(true);
  });

  it("switches to another instance", () => {
    const mgr = new InstanceManager(makeInstance("default"));
    mgr.add(makeInstance("secondary"));
    const switched = mgr.switch("secondary");
    expect(switched).toBe(true);
    expect(mgr.getActiveName()).toBe("secondary");
  });

  it("returns false when switching to a non-existent instance", () => {
    const mgr = new InstanceManager(makeInstance("default"));
    const switched = mgr.switch("nonexistent");
    expect(switched).toBe(false);
    expect(mgr.getActiveName()).toBe("default");
  });

  it("can remove old active after switching", () => {
    const mgr = new InstanceManager(makeInstance("default"));
    mgr.add(makeInstance("secondary"));
    mgr.switch("secondary");
    const removed = mgr.remove("default");
    expect(removed).toBe(true);
    expect(mgr.has("default")).toBe(false);
    expect(mgr.getActiveName()).toBe("secondary");
  });

  it("getActive returns a PortainerClient", () => {
    const mgr = new InstanceManager(makeInstance("default"));
    const client = mgr.getActive();
    // PortainerClient has dockerPath method
    expect(typeof client.dockerPath).toBe("function");
  });

  it("getActiveInfo returns instance info of active instance", () => {
    const mgr = new InstanceManager(makeInstance("default", "https://my-portainer.com"));
    const info = mgr.getActiveInfo();
    expect(info.name).toBe("default");
    expect(info.url).toBe("https://my-portainer.com");
    expect(info.token).toBe("default-token");
  });

  it("list returns all instances with active flag", () => {
    const mgr = new InstanceManager(makeInstance("default"));
    mgr.add(makeInstance("prod", "https://prod.example.com"));
    mgr.add(makeInstance("staging", "https://staging.example.com"));

    const list = mgr.list();
    expect(list).toHaveLength(3);

    const defaultEntry = list.find((e) => e.name === "default");
    expect(defaultEntry).toBeDefined();
    expect(defaultEntry!.active).toBe(true);

    const prodEntry = list.find((e) => e.name === "prod");
    expect(prodEntry).toBeDefined();
    expect(prodEntry!.active).toBe(false);
    expect(prodEntry!.url).toBe("https://prod.example.com");

    const stagingEntry = list.find((e) => e.name === "staging");
    expect(stagingEntry).toBeDefined();
    expect(stagingEntry!.active).toBe(false);
  });

  it("list shows correct active flag after switching", () => {
    const mgr = new InstanceManager(makeInstance("default"));
    mgr.add(makeInstance("secondary"));
    mgr.switch("secondary");

    const list = mgr.list();
    const defaultEntry = list.find((e) => e.name === "default");
    const secondaryEntry = list.find((e) => e.name === "secondary");
    expect(defaultEntry!.active).toBe(false);
    expect(secondaryEntry!.active).toBe(true);
  });

  it("getClient returns client by name", () => {
    const mgr = new InstanceManager(makeInstance("default"));
    mgr.add(makeInstance("other"));
    const client = mgr.getClient("other");
    expect(client).toBeDefined();
    expect(typeof client!.dockerPath).toBe("function");
  });

  it("getClient returns undefined for non-existent instance", () => {
    const mgr = new InstanceManager(makeInstance("default"));
    const client = mgr.getClient("ghost");
    expect(client).toBeUndefined();
  });

  it("has returns false for non-existent instance", () => {
    const mgr = new InstanceManager(makeInstance("default"));
    expect(mgr.has("nonexistent")).toBe(false);
  });

  it("overwriting an existing instance replaces it", () => {
    const mgr = new InstanceManager(makeInstance("default", "https://old.example.com"));
    mgr.add(makeInstance("default", "https://new.example.com"));
    const info = mgr.getActiveInfo();
    expect(info.url).toBe("https://new.example.com");
  });
});
