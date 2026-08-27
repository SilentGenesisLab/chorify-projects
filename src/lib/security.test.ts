import { describe, expect, it } from "vitest";
import { createPersonalToken, sha256 } from "./security";

describe("personal API token", () => {
  it("creates a display-once token and stable hash", () => {
    const result = createPersonalToken();
    expect(result.token).toMatch(/^chp_[A-Za-z0-9_-]+$/);
    expect(result.prefix).toBe(result.token.slice(0, 12));
    expect(result.tokenHash).toBe(sha256(result.token));
    expect(result.tokenHash).not.toContain(result.token);
  });
  it("creates unique credentials", () => expect(createPersonalToken().token).not.toBe(createPersonalToken().token));
});
