/**
 * Wraps data as a JSON text MCP response.
 * @param data - The data to serialize as JSON
 * @returns MCP tool response with JSON content
 */
export function jsonResponse(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
  };
}

/**
 * Wraps a string as a plain text MCP response.
 * @param text - The text content
 * @returns MCP tool response with text content
 */
export function textResponse(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

/**
 * Converts an error into an MCP error response with contextual hints
 * for common Portainer API status codes (401, 403, 404, 409).
 * @param error - The caught error (Error instance or unknown)
 * @returns MCP tool response with isError flag set
 */
export function errorResponse(error: unknown) {
  let message: string;
  if (error instanceof Error) {
    message = error.message;
    // Include status code context from Portainer API errors
    if (message.includes("Portainer API error")) {
      const statusMatch = message.match(/error (\d+)/);
      const status = statusMatch ? Number(statusMatch[1]) : 0;
      if (status === 401) message += " (check API token)";
      else if (status === 403) message += " (insufficient permissions)";
      else if (status === 404) message += " (resource not found)";
      else if (status === 409) message += " (resource conflict)";
    }
  } else {
    message = String(error);
  }
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

/**
 * Slices an array according to pagination parameters.
 * @param items - The full array to paginate
 * @param limit - Maximum number of items to return (defaults to all)
 * @param offset - Number of items to skip from the start (defaults to 0)
 * @returns Object containing the page of data plus pagination metadata
 */
export function paginate<T>(items: T[], limit?: number, offset?: number): { data: T[]; total: number; offset: number; limit: number } {
  const total = items.length;
  const off = offset || 0;
  const lim = limit || total;
  return {
    data: items.slice(off, off + lim),
    total,
    offset: off,
    limit: lim,
  };
}

/**
 * Paginates an array and wraps the result as a JSON MCP response.
 * @param items - The full array to paginate
 * @param limit - Maximum number of items to return (defaults to all)
 * @param offset - Number of items to skip from the start (defaults to 0)
 * @returns MCP tool response containing paginated data and metadata
 */
export function paginatedResponse<T>(items: T[], limit?: number, offset?: number) {
  const result = paginate(items, limit, offset);
  return jsonResponse(result);
}
