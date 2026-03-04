import { describe, it, expect } from "vitest";
import {
  summarizeContainer,
  summarizeContainerInspect,
  summarizeImage,
  summarizeImageInspect,
} from "../utils/filters.js";

describe("summarizeContainer", () => {
  it("extracts the correct fields from a container object", () => {
    const container = {
      Id: "abc123def456ghijklmn",
      Names: ["/my-container"],
      Image: "nginx:latest",
      State: "running",
      Status: "Up 2 hours",
      Created: 1700000000,
      Ports: [{ PrivatePort: 80, PublicPort: 8080, Type: "tcp" }],
      Labels: { "com.example.env": "production" },
      ExtraField: "should be excluded",
      NetworkSettings: { Networks: {} },
    };
    const result = summarizeContainer(container);
    expect(result.Id).toBe("abc123def456");
    expect(result.Names).toEqual(["/my-container"]);
    expect(result.Image).toBe("nginx:latest");
    expect(result.State).toBe("running");
    expect(result.Status).toBe("Up 2 hours");
    expect(result.Created).toBe(1700000000);
    expect(result.Ports).toEqual([{ PrivatePort: 80, PublicPort: 8080, Type: "tcp" }]);
    expect(result.Labels).toEqual({ "com.example.env": "production" });
    // Extra fields should not be included
    expect(result).not.toHaveProperty("ExtraField");
    expect(result).not.toHaveProperty("NetworkSettings");
  });

  it("truncates Id to 12 characters", () => {
    const container = {
      Id: "abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz01",
    };
    const result = summarizeContainer(container);
    expect((result.Id as string).length).toBe(12);
    expect(result.Id).toBe("abcdefghijkl");
  });

  it("passes through Id unchanged when it is not a string", () => {
    const container = { Id: 12345 };
    const result = summarizeContainer(container);
    expect(result.Id).toBe(12345);
  });

  it("handles missing optional fields gracefully", () => {
    const container = { Id: "abc123def456" };
    const result = summarizeContainer(container);
    expect(result.Names).toBeUndefined();
    expect(result.Image).toBeUndefined();
    expect(result.State).toBeUndefined();
    expect(result.Ports).toBeUndefined();
    expect(result.Labels).toBeUndefined();
  });

  it("handles container with empty arrays and objects", () => {
    const container = {
      Id: "abc123def456",
      Names: [],
      Ports: [],
      Labels: {},
    };
    const result = summarizeContainer(container);
    expect(result.Names).toEqual([]);
    expect(result.Ports).toEqual([]);
    expect(result.Labels).toEqual({});
  });
});

describe("summarizeContainerInspect", () => {
  it("extracts nested fields from State, Config, NetworkSettings, and HostConfig", () => {
    const container = {
      Id: "abc123def456ghijklmnopqrstuvwxyz",
      Name: "/my-container",
      State: {
        Status: "running",
        Running: true,
        StartedAt: "2024-01-01T00:00:00Z",
        FinishedAt: "0001-01-01T00:00:00Z",
        ExitCode: 0,
        Pid: 1234,
      },
      Config: {
        Image: "nginx:latest",
        Env: ["NODE_ENV=production"],
        Cmd: ["nginx", "-g", "daemon off;"],
        Labels: { app: "web" },
        Hostname: "abc123",
      },
      NetworkSettings: {
        Ports: { "80/tcp": [{ HostPort: "8080" }] },
        Networks: {},
      },
      HostConfig: {
        RestartPolicy: { Name: "always", MaximumRetryCount: 0 },
        Memory: 0,
      },
      Mounts: [{ Type: "volume", Name: "data", Destination: "/data" }],
      Created: "2024-01-01T00:00:00Z",
      Platform: "linux",
    };

    const result = summarizeContainerInspect(container);
    expect(result.Id).toBe("abc123def456");
    expect(result.Name).toBe("/my-container");
    // State should only include specific fields
    expect(result.State).toEqual({
      Status: "running",
      Running: true,
      StartedAt: "2024-01-01T00:00:00Z",
      FinishedAt: "0001-01-01T00:00:00Z",
      ExitCode: 0,
    });
    // State should NOT include Pid (not in the summarized fields)
    expect((result.State as Record<string, unknown>)?.Pid).toBeUndefined();
    expect(result.Image).toBe("nginx:latest");
    expect(result.Env).toEqual(["NODE_ENV=production"]);
    expect(result.Cmd).toEqual(["nginx", "-g", "daemon off;"]);
    expect(result.Labels).toEqual({ app: "web" });
    expect(result.Ports).toEqual({ "80/tcp": [{ HostPort: "8080" }] });
    expect(result.Mounts).toEqual([{ Type: "volume", Name: "data", Destination: "/data" }]);
    expect(result.RestartPolicy).toEqual({ Name: "always", MaximumRetryCount: 0 });
    expect(result.Created).toBe("2024-01-01T00:00:00Z");
    expect(result.Platform).toBe("linux");
  });

  it("handles missing nested objects gracefully", () => {
    const container = {
      Id: "abc123def456ghijklmnop",
      Name: "/test",
    };
    const result = summarizeContainerInspect(container);
    expect(result.State).toBeUndefined();
    expect(result.Image).toBeUndefined();
    expect(result.Env).toBeUndefined();
    expect(result.Ports).toBeUndefined();
    expect(result.RestartPolicy).toBeUndefined();
  });

  it("truncates Id to 12 characters", () => {
    const container = {
      Id: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    };
    const result = summarizeContainerInspect(container);
    expect(result.Id).toBe("0123456789ab");
  });
});

describe("summarizeImage", () => {
  it("extracts correct fields from an image object", () => {
    const image = {
      Id: "sha256:abcdef12345667890abcdef",
      RepoTags: ["nginx:latest", "nginx:1.25"],
      RepoDigests: ["nginx@sha256:abc123"],
      Created: 1700000000,
      Size: 187000000,
      Labels: { maintainer: "NGINX" },
      Containers: -1,
      SharedSize: -1,
    };
    const result = summarizeImage(image);
    expect(result.Id).toBe("sha256:abcdef123456");
    expect(result.RepoTags).toEqual(["nginx:latest", "nginx:1.25"]);
    expect(result.RepoDigests).toEqual(["nginx@sha256:abc123"]);
    expect(result.Created).toBe(1700000000);
    expect(result.Size).toBe(187000000);
    expect(result.Labels).toEqual({ maintainer: "NGINX" });
    // Extra fields not included
    expect(result).not.toHaveProperty("Containers");
    expect(result).not.toHaveProperty("SharedSize");
  });

  it("truncates Id to 19 characters", () => {
    const image = {
      Id: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    };
    const result = summarizeImage(image);
    expect((result.Id as string).length).toBe(19);
    expect(result.Id).toBe("sha256:0123456789ab");
  });

  it("passes through non-string Id unchanged", () => {
    const image = { Id: 999 };
    const result = summarizeImage(image);
    expect(result.Id).toBe(999);
  });

  it("handles image with empty repo tags", () => {
    const image = {
      Id: "sha256:abcdef12345667890abcdef",
      RepoTags: [],
      Size: 0,
    };
    const result = summarizeImage(image);
    expect(result.RepoTags).toEqual([]);
    expect(result.Size).toBe(0);
  });

  it("handles image with null repo tags", () => {
    const image = {
      Id: "sha256:abcdef12345667890abcdef",
      RepoTags: null,
    };
    const result = summarizeImage(image);
    expect(result.RepoTags).toBeNull();
  });
});

describe("summarizeImageInspect", () => {
  it("extracts nested config fields from image inspect", () => {
    const image = {
      Id: "sha256:abcdef12345667890abcdef",
      RepoTags: ["nginx:latest"],
      RepoDigests: ["nginx@sha256:abc123"],
      Created: "2024-01-01T00:00:00Z",
      Size: 187000000,
      Architecture: "amd64",
      Os: "linux",
      Author: "NGINX",
      Config: {
        Env: ["PATH=/usr/local/sbin:/usr/local/bin"],
        Cmd: ["nginx", "-g", "daemon off;"],
        ExposedPorts: { "80/tcp": {} },
        Labels: { maintainer: "NGINX" },
        Volumes: { "/data": {} },
        Hostname: "",
      },
      RootFS: { Type: "layers" },
    };

    const result = summarizeImageInspect(image);
    expect(result.Id).toBe("sha256:abcdef123456");
    expect(result.RepoTags).toEqual(["nginx:latest"]);
    expect(result.Architecture).toBe("amd64");
    expect(result.Os).toBe("linux");
    expect(result.Author).toBe("NGINX");
    expect(result.Env).toEqual(["PATH=/usr/local/sbin:/usr/local/bin"]);
    expect(result.Cmd).toEqual(["nginx", "-g", "daemon off;"]);
    expect(result.ExposedPorts).toEqual({ "80/tcp": {} });
    expect(result.Labels).toEqual({ maintainer: "NGINX" });
    expect(result.Volumes).toEqual({ "/data": {} });
    // Extra fields not included
    expect(result).not.toHaveProperty("RootFS");
    expect(result).not.toHaveProperty("Hostname");
  });

  it("handles missing Config gracefully", () => {
    const image = {
      Id: "sha256:abcdef12345667890abcdef",
      Architecture: "arm64",
      Os: "linux",
    };
    const result = summarizeImageInspect(image);
    expect(result.Env).toBeUndefined();
    expect(result.Cmd).toBeUndefined();
    expect(result.ExposedPorts).toBeUndefined();
    expect(result.Labels).toBeUndefined();
    expect(result.Volumes).toBeUndefined();
    expect(result.Architecture).toBe("arm64");
    expect(result.Os).toBe("linux");
  });

  it("truncates Id to 19 characters for image inspect", () => {
    const image = {
      Id: "sha256:0123456789abcdef0123456789abcdef",
    };
    const result = summarizeImageInspect(image);
    expect((result.Id as string).length).toBe(19);
  });
});
