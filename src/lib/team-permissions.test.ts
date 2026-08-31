import { describe, expect, it } from "vitest";
import { canCreateTeamProject, isTeamManager, maskedPhone } from "./team-permissions";

describe("team permissions", () => {
  it("allows only owners and administrators to manage a team", () => {
    expect(isTeamManager("OWNER")).toBe(true);
    expect(isTeamManager("ADMIN")).toBe(true);
    expect(isTeamManager("MEMBER")).toBe(false);
    expect(isTeamManager("GUEST")).toBe(false);
  });

  it("masks member phone numbers in team responses", () => {
    expect(maskedPhone("13812345678")).toBe("138****5678");
  });

  it("allows formal team members to create projects but not guests", () => {
    expect(canCreateTeamProject("OWNER")).toBe(true);
    expect(canCreateTeamProject("ADMIN")).toBe(true);
    expect(canCreateTeamProject("MEMBER")).toBe(true);
    expect(canCreateTeamProject("GUEST")).toBe(false);
  });
});
