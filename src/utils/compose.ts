import YAML from "yaml";

/** Result of validating a Docker Compose file. */
export interface ComposeValidationResult {
  /** Whether the compose file is valid */
  valid: boolean;
  /** List of validation error messages (empty when valid) */
  errors: string[];
}

/**
 * Validates a Docker Compose file string for structural correctness.
 * Checks for valid YAML syntax, required 'services' key, valid service names,
 * and that each service has an 'image' or 'build' directive.
 *
 * @param content - The raw YAML string of the compose file
 * @returns Validation result with a list of errors (if any)
 *
 * @example
 * ```ts
 * const result = validateCompose("services:\n  web:\n    image: nginx\n");
 * // result.valid === true, result.errors === []
 * ```
 */
export function validateCompose(content: string): ComposeValidationResult {
  const errors: string[] = [];

  if (!content.trim()) {
    return { valid: false, errors: ["Compose file content is empty"] };
  }

  // Check for tab indentation before parsing (YAML does not allow tabs)
  const lines = content.split("\n");
  for (const line of lines) {
    if (/^\t/.test(line)) {
      errors.push(
        "YAML does not allow tab characters for indentation. Use spaces instead."
      );
      break;
    }
  }

  // Parse YAML properly
  let doc: unknown;
  try {
    doc = YAML.parse(content);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    errors.push(`YAML syntax error: ${message}`);
    return { valid: errors.length === 0, errors };
  }

  // Must be an object at the top level
  if (doc === null || doc === undefined || typeof doc !== "object" || Array.isArray(doc)) {
    errors.push("Compose file must be a YAML mapping (key-value structure) at the top level");
    return { valid: errors.length === 0, errors };
  }

  const root = doc as Record<string, unknown>;

  // Must have services key
  if (!("services" in root) || root.services === undefined) {
    errors.push("Missing required top-level 'services' key");
    return { valid: errors.length === 0, errors };
  }

  const services = root.services;

  // Services must be a mapping
  if (
    services === null ||
    typeof services !== "object" ||
    Array.isArray(services)
  ) {
    errors.push("No services defined under 'services' key");
    return { valid: errors.length === 0, errors };
  }

  const svcMap = services as Record<string, unknown>;
  const serviceNames = Object.keys(svcMap);

  if (serviceNames.length === 0) {
    errors.push("No services defined under 'services' key");
    return { valid: errors.length === 0, errors };
  }

  for (const name of serviceNames) {
    // Validate service name characters
    if (/[^a-zA-Z0-9._-]/.test(name)) {
      errors.push(
        `Service name '${name}' contains invalid characters. Use only letters, digits, hyphens, underscores, and dots.`
      );
    }

    // Each service must have 'image' or 'build'
    const svcDef = svcMap[name];
    if (
      svcDef === null ||
      svcDef === undefined ||
      typeof svcDef !== "object" ||
      Array.isArray(svcDef)
    ) {
      errors.push(`Service '${name}' has neither 'image' nor 'build' specified`);
      continue;
    }

    const svcObj = svcDef as Record<string, unknown>;
    if (!("image" in svcObj) && !("build" in svcObj)) {
      errors.push(`Service '${name}' has neither 'image' nor 'build' specified`);
    }
  }

  return { valid: errors.length === 0, errors };
}
