import { describe, expect, it } from "vitest";
import { API_TOKEN_PERMISSIONS, DEFAULT_API_PERMISSIONS, hasApiPermission } from "./api-token-permissions";

describe("API token permissions", () => {
  it("keeps the catalog unique and defaults valid", () => {
    expect(new Set(API_TOKEN_PERMISSIONS).size).toBe(API_TOKEN_PERMISSIONS.length);
    expect(DEFAULT_API_PERMISSIONS.every((permission) => API_TOKEN_PERMISSIONS.includes(permission))).toBe(true);
  });
  it("does not imply write access from read access", () => {
    expect(hasApiPermission(["task:read"], "task:read")).toBe(true);
    expect(hasApiPermission(["task:read"], "task:report")).toBe(false);
    expect(hasApiPermission(["document:read"], "document:write")).toBe(false);
  });
});
