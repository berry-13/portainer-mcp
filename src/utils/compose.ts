export interface ComposeValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCompose(content: string): ComposeValidationResult {
  const errors: string[] = [];

  if (!content.trim()) {
    return { valid: false, errors: ["Compose file content is empty"] };
  }

  // Basic YAML structure checks (without a full YAML parser)
  const lines = content.split("\n");
  const topLevelKeys = new Set<string>();
  let hasIndentation = false;

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Top-level key detection (no leading whitespace, ends with colon)
    if (!line.startsWith(" ") && !line.startsWith("\t") && trimmed.includes(":")) {
      const key = trimmed.split(":")[0].trim();
      topLevelKeys.add(key);
    } else if (line.startsWith(" ") || line.startsWith("\t")) {
      hasIndentation = true;
    }

    // Check for tabs (YAML doesn't allow tabs for indentation)
    if (/^\t/.test(line)) {
      errors.push("YAML does not allow tab characters for indentation. Use spaces instead.");
      break;
    }
  }

  // Must have services key
  if (!topLevelKeys.has("services")) {
    errors.push("Missing required top-level 'services' key");
  }

  // Should have some indented content under top-level keys
  if (topLevelKeys.size > 0 && !hasIndentation) {
    errors.push("Compose file appears to have no service definitions (no indented content)");
  }

  // Check for common mistakes
  if (topLevelKeys.has("version")) {
    // version is deprecated in compose v2+ but not an error
  }

  // Validate service block structure
  const serviceBlockMatch = content.match(/^services:\s*\n([\s\S]*?)(?=^\S|\Z)/m);
  if (serviceBlockMatch) {
    const serviceBlock = serviceBlockMatch[1];
    const serviceNames = serviceBlock.match(/^  (\S+):/gm);
    if (!serviceNames || serviceNames.length === 0) {
      errors.push("No services defined under 'services' key");
    } else {
      for (const svc of serviceNames) {
        const name = svc.trim().replace(/:$/, "");
        // Service names should be valid
        if (/[^a-zA-Z0-9._-]/.test(name)) {
          errors.push(`Service name '${name}' contains invalid characters. Use only letters, digits, hyphens, underscores, and dots.`);
        }
      }
    }

    // Check that services with 'image' or 'build' are defined
    const serviceEntries = serviceBlock.split(/^  (?=\S)/m).filter(Boolean);
    for (const entry of serviceEntries) {
      const nameMatch = entry.match(/^(\S+):/);
      if (nameMatch) {
        const name = nameMatch[1];
        if (!entry.includes("image:") && !entry.includes("build:")) {
          errors.push(`Service '${name}' has neither 'image' nor 'build' specified`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
