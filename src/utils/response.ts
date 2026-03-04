export function jsonResponse(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
  };
}

export function textResponse(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

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

export function paginatedResponse<T>(items: T[], limit?: number, offset?: number) {
  const result = paginate(items, limit, offset);
  return jsonResponse(result);
}
