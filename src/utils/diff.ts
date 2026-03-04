import YAML from "yaml";

/** Result of comparing two Docker Compose files at the service level. */
export interface DiffResult {
  /** Service names present in the new text but not the old */
  added: string[];
  /** Service names present in the old text but not the new */
  removed: string[];
  /** Service names present in both but with different definitions */
  modified: string[];
  /** Service names present in both with identical definitions */
  unchanged: string[];
  /** Unified-diff-style text showing line-level changes */
  diffText: string;
}

/**
 * Produces a simple unified-diff-style text comparing two strings line by line.
 * @param oldText - The original text
 * @param newText - The updated text
 * @param label - Label used in the diff header (defaults to "compose")
 * @returns A human-readable diff string, or "No differences found." if identical
 */
export function diffLines(oldText: string, newText: string, label: string = "compose"): string {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  const output: string[] = [];
  output.push(`--- current ${label}`);
  output.push(`+++ proposed ${label}`);

  // Simple line-by-line diff
  const maxLen = Math.max(oldLines.length, newLines.length);
  let contextStart = -1;

  for (let i = 0; i < maxLen; i++) {
    const oldLine = i < oldLines.length ? oldLines[i] : undefined;
    const newLine = i < newLines.length ? newLines[i] : undefined;

    if (oldLine === newLine) {
      continue;
    }

    if (contextStart === -1 || i - contextStart > 3) {
      output.push(`@@ line ${i + 1} @@`);
      contextStart = i;
    }

    if (oldLine !== undefined && newLine !== undefined) {
      output.push(`- ${oldLine}`);
      output.push(`+ ${newLine}`);
    } else if (oldLine === undefined) {
      output.push(`+ ${newLine}`);
    } else {
      output.push(`- ${oldLine}`);
    }
  }

  if (output.length === 2) {
    return "No differences found.";
  }

  return output.join("\n");
}

/**
 * Compares two Docker Compose files and categorizes services as added, removed,
 * modified, or unchanged. Also includes a line-level diff of the full content.
 * @param oldText - The original compose file content
 * @param newText - The updated compose file content
 * @returns A DiffResult with categorized service changes and a textual diff
 */
export function diffComposeServices(oldText: string, newText: string): DiffResult {
  const oldServices = extractServiceNames(oldText);
  const newServices = extractServiceNames(newText);

  const added = newServices.filter(s => !oldServices.includes(s));
  const removed = oldServices.filter(s => !newServices.includes(s));
  const common = oldServices.filter(s => newServices.includes(s));

  const modified: string[] = [];
  const unchanged: string[] = [];

  for (const svc of common) {
    const oldBlock = extractServiceBlock(oldText, svc);
    const newBlock = extractServiceBlock(newText, svc);
    if (oldBlock !== newBlock) {
      modified.push(svc);
    } else {
      unchanged.push(svc);
    }
  }

  const diffText = diffLines(oldText, newText, "compose");

  return { added, removed, modified, unchanged, diffText };
}

function extractServiceNames(compose: string): string[] {
  try {
    const doc = YAML.parse(compose);
    if (
      doc &&
      typeof doc === "object" &&
      !Array.isArray(doc) &&
      "services" in doc &&
      doc.services &&
      typeof doc.services === "object" &&
      !Array.isArray(doc.services)
    ) {
      return Object.keys(doc.services as Record<string, unknown>);
    }
  } catch {
    // If YAML parsing fails, return empty array
  }
  return [];
}

function extractServiceBlock(compose: string, serviceName: string): string {
  try {
    const doc = YAML.parse(compose);
    if (
      doc &&
      typeof doc === "object" &&
      !Array.isArray(doc) &&
      "services" in doc &&
      doc.services &&
      typeof doc.services === "object" &&
      !Array.isArray(doc.services)
    ) {
      const services = doc.services as Record<string, unknown>;
      if (serviceName in services) {
        // Serialize the service definition back to YAML for consistent comparison
        return YAML.stringify(services[serviceName]);
      }
    }
  } catch {
    // If YAML parsing fails, return empty string
  }
  return "";
}
