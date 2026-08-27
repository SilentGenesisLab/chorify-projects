import { describe, expect, it } from "vitest";
import { createPersonalToken, createTeamInviteToken, decryptTeamInviteToken, encryptTeamInviteToken, sha256 } from "./security";

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

describe("team invitation token", () => {
  it("creates a token and stores a stable hash", () => {
    const result = createTeamInviteToken();
    expect(result.token).toMatch(/^cht_[A-Za-z0-9_-]+$/);
    expect(result.prefix).toBe(result.token.slice(0, 12));
    expect(result.tokenHash).toBe(sha256(result.token));
    expect(result.tokenHash).not.toContain(result.token);
  });
  it("encrypts invitation tokens for later manager-only copying", () => {
    const token = createTeamInviteToken().token;
    const encrypted = encryptTeamInviteToken(token, "test-secret-at-least-32-characters");
    expect(encrypted).not.toContain(token);
    expect(decryptTeamInviteToken(encrypted, "test-secret-at-least-32-characters")).toBe(token);
    expect(decryptTeamInviteToken(encrypted, "wrong-secret-at-least-32-characters")).toBeNull();
  });
});
