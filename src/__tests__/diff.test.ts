import { describe, it, expect } from "vitest";
import { diffLines, diffComposeServices } from "../utils/diff.js";

describe("diffLines", () => {
  it("returns no differences for identical content", () => {
    const text = "services:\n  web:\n    image: nginx\n";
    const result = diffLines(text, text);
    expect(result).toBe("No differences found.");
  });

  it("shows added lines when new text has extra lines", () => {
    const oldText = "line1\nline2";
    const newText = "line1\nline2\nline3\nline4";
    const result = diffLines(oldText, newText);
    expect(result).toContain("+ line3");
    expect(result).toContain("+ line4");
  });

  it("shows removed lines when old text has extra lines", () => {
    const oldText = "line1\nline2\nline3";
    const newText = "line1";
    const result = diffLines(oldText, newText);
    expect(result).toContain("- line2");
    expect(result).toContain("- line3");
  });

  it("shows modified lines with both - and + markers", () => {
    const oldText = "services:\n  web:\n    image: nginx:1.0";
    const newText = "services:\n  web:\n    image: nginx:2.0";
    const result = diffLines(oldText, newText);
    expect(result).toContain("- " + "    image: nginx:1.0");
    expect(result).toContain("+ " + "    image: nginx:2.0");
  });

  it("includes header lines with label", () => {
    const result = diffLines("a", "b", "stack");
    expect(result).toContain("--- current stack");
    expect(result).toContain("+++ proposed stack");
  });

  it("uses default label 'compose' when none provided", () => {
    const result = diffLines("a", "b");
    expect(result).toContain("--- current compose");
    expect(result).toContain("+++ proposed compose");
  });

  it("includes @@ line markers for changed sections", () => {
    const oldText = "line1\nline2\nline3";
    const newText = "line1\nmodified\nline3";
    const result = diffLines(oldText, newText);
    expect(result).toMatch(/@@ line \d+ @@/);
  });

  it("handles empty old text (all additions)", () => {
    const result = diffLines("", "line1\nline2");
    expect(result).toContain("+ line1");
    expect(result).toContain("+ line2");
  });

  it("handles empty new text (all removals)", () => {
    const result = diffLines("line1\nline2", "");
    expect(result).toContain("- line1");
    expect(result).toContain("- line2");
  });
});

describe("diffComposeServices", () => {
  it("detects added services", () => {
    const oldCompose = `services:
  web:
    image: nginx
`;
    const newCompose = `services:
  web:
    image: nginx
  db:
    image: postgres
`;
    const result = diffComposeServices(oldCompose, newCompose);
    expect(result.added).toContain("db");
    expect(result.removed).toHaveLength(0);
    expect(result.unchanged).toContain("web");
  });

  it("detects removed services", () => {
    const oldCompose = `services:
  web:
    image: nginx
  db:
    image: postgres
`;
    const newCompose = `services:
  web:
    image: nginx
`;
    const result = diffComposeServices(oldCompose, newCompose);
    expect(result.removed).toContain("db");
    expect(result.added).toHaveLength(0);
  });

  it("detects modified services", () => {
    const oldCompose = `services:
  web:
    image: nginx:1.0
`;
    const newCompose = `services:
  web:
    image: nginx:2.0
`;
    const result = diffComposeServices(oldCompose, newCompose);
    expect(result.modified).toContain("web");
    expect(result.unchanged).toHaveLength(0);
  });

  it("detects unchanged services", () => {
    const compose = `services:
  web:
    image: nginx:latest
`;
    const result = diffComposeServices(compose, compose);
    expect(result.unchanged).toContain("web");
    expect(result.modified).toHaveLength(0);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
    expect(result.diffText).toBe("No differences found.");
  });

  it("handles complex changes with additions, removals, and modifications", () => {
    const oldCompose = `services:
  web:
    image: nginx:1.0
  api:
    image: node:14
  worker:
    image: python:3.9
`;
    const newCompose = `services:
  web:
    image: nginx:2.0
  worker:
    image: python:3.9
  cache:
    image: redis:7
`;
    const result = diffComposeServices(oldCompose, newCompose);
    expect(result.added).toContain("cache");
    expect(result.removed).toContain("api");
    expect(result.modified).toContain("web");
    expect(result.unchanged).toContain("worker");
  });

  it("returns diffText with line-level differences", () => {
    const oldCompose = `services:
  web:
    image: nginx:1.0
`;
    const newCompose = `services:
  web:
    image: nginx:2.0
`;
    const result = diffComposeServices(oldCompose, newCompose);
    expect(result.diffText).toContain("---");
    expect(result.diffText).toContain("+++");
    expect(result.diffText).not.toBe("No differences found.");
  });

  it("handles compose with no services section", () => {
    const oldCompose = `volumes:
  data:
    driver: local
`;
    const newCompose = `services:
  web:
    image: nginx
`;
    const result = diffComposeServices(oldCompose, newCompose);
    expect(result.added).toContain("web");
    expect(result.removed).toHaveLength(0);
  });
});
