export interface DiffResult {
  added: string[];
  removed: string[];
  modified: string[];
  unchanged: string[];
  diffText: string;
}

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
  const services: string[] = [];
  const lines = compose.split("\n");
  let inServices = false;

  for (const line of lines) {
    if (/^services:\s*$/.test(line) || /^services:/.test(line)) {
      inServices = true;
      continue;
    }
    if (inServices && /^\S/.test(line) && !line.startsWith("#")) {
      inServices = false;
      continue;
    }
    if (inServices && /^  \S/.test(line) && line.includes(":")) {
      const name = line.trim().split(":")[0].trim();
      services.push(name);
    }
  }

  return services;
}

function extractServiceBlock(compose: string, serviceName: string): string {
  const lines = compose.split("\n");
  let capturing = false;
  const block: string[] = [];

  for (const line of lines) {
    if (new RegExp(`^  ${serviceName}:\\s*`).test(line)) {
      capturing = true;
      block.push(line);
      continue;
    }
    if (capturing) {
      // Stop at next service (2-space indent, non-space content) or top-level key
      if ((/^  \S/.test(line) && line.includes(":")) || /^\S/.test(line)) {
        break;
      }
      block.push(line);
    }
  }

  return block.join("\n");
}
