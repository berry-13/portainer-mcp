import { describe, it, expect } from "vitest";
import { jsonResponse, textResponse, errorResponse, paginate, paginatedResponse } from "../utils/response.js";

describe("jsonResponse", () => {
  it("wraps data in content array with JSON stringified text", () => {
    const data = { name: "test", count: 42 };
    const result = jsonResponse(data);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toBe(JSON.stringify(data));
  });

  it("handles arrays", () => {
    const data = [1, 2, 3];
    const result = jsonResponse(data);
    expect(JSON.parse(result.content[0].text)).toEqual([1, 2, 3]);
  });

  it("handles null value", () => {
    const result = jsonResponse(null);
    expect(result.content[0].text).toBe("null");
  });

  it("handles nested objects", () => {
    const data = { outer: { inner: { deep: true } } };
    const result = jsonResponse(data);
    expect(JSON.parse(result.content[0].text)).toEqual(data);
  });

  it("handles empty object", () => {
    const result = jsonResponse({});
    expect(result.content[0].text).toBe("{}");
  });
});

describe("textResponse", () => {
  it("wraps text in content array", () => {
    const result = textResponse("hello world");
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toBe("hello world");
  });

  it("handles empty string", () => {
    const result = textResponse("");
    expect(result.content[0].text).toBe("");
  });

  it("preserves multiline text", () => {
    const text = "line1\nline2\nline3";
    const result = textResponse(text);
    expect(result.content[0].text).toBe(text);
  });
});

describe("errorResponse", () => {
  it("formats Error objects with their message", () => {
    const error = new Error("something went wrong");
    const result = errorResponse(error);
    expect(result.content[0].text).toBe("Error: something went wrong");
    expect(result.isError).toBe(true);
  });

  it("formats non-Error values by converting to string", () => {
    const result = errorResponse("raw string error");
    expect(result.content[0].text).toBe("Error: raw string error");
    expect(result.isError).toBe(true);
  });

  it("formats numeric non-Error values", () => {
    const result = errorResponse(404);
    expect(result.content[0].text).toBe("Error: 404");
    expect(result.isError).toBe(true);
  });

  it("appends hint for 401 Portainer API errors", () => {
    const error = new Error("Portainer API error 401: Unauthorized");
    const result = errorResponse(error);
    expect(result.content[0].text).toContain("(check API token)");
  });

  it("appends hint for 403 Portainer API errors", () => {
    const error = new Error("Portainer API error 403: Forbidden");
    const result = errorResponse(error);
    expect(result.content[0].text).toContain("(insufficient permissions)");
  });

  it("appends hint for 404 Portainer API errors", () => {
    const error = new Error("Portainer API error 404: Not Found");
    const result = errorResponse(error);
    expect(result.content[0].text).toContain("(resource not found)");
  });

  it("appends hint for 409 Portainer API errors", () => {
    const error = new Error("Portainer API error 409: Conflict");
    const result = errorResponse(error);
    expect(result.content[0].text).toContain("(resource conflict)");
  });

  it("does not append hint for non-Portainer errors", () => {
    const error = new Error("Network timeout");
    const result = errorResponse(error);
    expect(result.content[0].text).toBe("Error: Network timeout");
    // No extra hint appended
    expect(result.content[0].text).not.toContain("(check API token)");
    expect(result.content[0].text).not.toContain("(resource not found)");
  });

  it("handles undefined error value", () => {
    const result = errorResponse(undefined);
    expect(result.content[0].text).toBe("Error: undefined");
    expect(result.isError).toBe(true);
  });
});

describe("paginate", () => {
  const items = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

  it("returns all items when no limit or offset", () => {
    const result = paginate(items);
    expect(result.data).toEqual(items);
    expect(result.total).toBe(10);
    expect(result.offset).toBe(0);
    expect(result.limit).toBe(10);
  });

  it("slices correctly with limit", () => {
    const result = paginate(items, 3);
    expect(result.data).toEqual(["a", "b", "c"]);
    expect(result.total).toBe(10);
    expect(result.limit).toBe(3);
  });

  it("slices correctly with offset", () => {
    const result = paginate(items, undefined, 5);
    expect(result.data).toEqual(["f", "g", "h", "i", "j"]);
    expect(result.offset).toBe(5);
  });

  it("slices correctly with both limit and offset", () => {
    const result = paginate(items, 3, 2);
    expect(result.data).toEqual(["c", "d", "e"]);
    expect(result.total).toBe(10);
    expect(result.offset).toBe(2);
    expect(result.limit).toBe(3);
  });

  it("returns empty array when offset is beyond length", () => {
    const result = paginate(items, 5, 100);
    expect(result.data).toEqual([]);
    expect(result.total).toBe(10);
  });

  it("handles limit larger than remaining items", () => {
    const result = paginate(items, 100, 8);
    expect(result.data).toEqual(["i", "j"]);
    expect(result.total).toBe(10);
  });

  it("handles empty array", () => {
    const result = paginate([], 10, 0);
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("handles zero limit as falsy (returns all from offset)", () => {
    // 0 is falsy so limit defaults to total
    const result = paginate(items, 0);
    expect(result.data).toEqual(items);
  });
});

describe("paginatedResponse", () => {
  it("wraps paginated result as JSON in content array", () => {
    const items = [1, 2, 3, 4, 5];
    const result = paginatedResponse(items, 2, 1);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.data).toEqual([2, 3]);
    expect(parsed.total).toBe(5);
    expect(parsed.offset).toBe(1);
    expect(parsed.limit).toBe(2);
  });
});
