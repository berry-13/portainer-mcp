import { describe, it, expect } from "vitest";
import { validateCompose } from "../utils/compose.js";

describe("validateCompose", () => {
  it("returns invalid for empty content", () => {
    const result = validateCompose("");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Compose file content is empty");
  });

  it("returns invalid for whitespace-only content", () => {
    const result = validateCompose("   \n  \n   ");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Compose file content is empty");
  });

  it("returns valid for a correct compose file with services", () => {
    const compose = `services:
  web:
    image: nginx:latest
    ports:
      - "80:80"
  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: secret
`;
    const result = validateCompose(compose);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns invalid when services key is missing", () => {
    const compose = `version: "3"
volumes:
  data:
    driver: local
`;
    const result = validateCompose(compose);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required top-level 'services' key");
  });

  it("detects tab indentation and reports error", () => {
    const compose = "services:\n\tweb:\n\t\timage: nginx";
    const result = validateCompose(compose);
    expect(result.valid).toBe(false);
    const tabError = result.errors.find((e) =>
      e.includes("tab characters")
    );
    expect(tabError).toBeDefined();
  });

  it("detects service without image or build", () => {
    const compose = `services:
  web:
    ports:
      - "80:80"
`;
    const result = validateCompose(compose);
    expect(result.valid).toBe(false);
    const serviceError = result.errors.find((e) =>
      e.includes("has neither 'image' nor 'build' specified")
    );
    expect(serviceError).toBeDefined();
    expect(serviceError).toContain("web");
  });

  it("accepts service with build instead of image", () => {
    const compose = `services:
  app:
    build: ./app
    ports:
      - "3000:3000"
`;
    const result = validateCompose(compose);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("detects invalid service name characters", () => {
    const compose = `services:
  web app:
    image: nginx
`;
    const result = validateCompose(compose);
    expect(result.valid).toBe(false);
    const nameError = result.errors.find((e) =>
      e.includes("invalid characters")
    );
    expect(nameError).toBeDefined();
  });

  it("allows valid service name characters (letters, digits, hyphens, underscores, dots)", () => {
    const compose = `services:
  my-app_v2.0:
    image: myapp:latest
`;
    const result = validateCompose(compose);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("detects empty services section (services key with no definitions)", () => {
    const compose = `services:
`;
    const result = validateCompose(compose);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("No services defined under 'services' key");
  });

  it("handles compose with comment lines gracefully", () => {
    const compose = `# This is a compose file
services:
  # Web service
  web:
    image: nginx:latest
`;
    const result = validateCompose(compose);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("handles compose with version key (deprecated but not an error)", () => {
    const compose = `version: "3.8"
services:
  web:
    image: nginx:latest
`;
    const result = validateCompose(compose);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("detects multiple services where some lack image/build", () => {
    const compose = `services:
  web:
    image: nginx
  api:
    ports:
      - "8080:8080"
  db:
    image: postgres
`;
    const result = validateCompose(compose);
    expect(result.valid).toBe(false);
    const apiError = result.errors.find(
      (e) => e.includes("api") && e.includes("neither 'image' nor 'build'")
    );
    expect(apiError).toBeDefined();
  });
});
