import { describe, expect, it } from "vitest";
import { taskMatchesScope, taskRoleForUser } from "./task-scope";

const task = (input: Partial<{ assigneeId:string|null; acceptorId:string|null; createdById:string|null; status:string }> = {}) => ({ assigneeId:null, acceptorId:null, createdById:null, status:"TODO", ...input });

describe("task scope", () => {
  it("keeps self-assigned tasks in mine even when the user created them", () => {
    const value = task({ assigneeId:"me", createdById:"me" });
    expect(taskMatchesScope(value,"me","mine")).toBe(true);
    expect(taskMatchesScope(value,"me","delegated")).toBe(false);
  });
  it("includes acceptance only while pending acceptance", () => {
    expect(taskRoleForUser(task({ acceptorId:"me", status:"PENDING_ACCEPTANCE" }),"me")).toBe("ACCEPTOR");
    expect(taskRoleForUser(task({ acceptorId:"me", status:"DONE" }),"me")).toBeNull();
  });
  it("requires a different, assigned owner for delegated tasks", () => {
    expect(taskMatchesScope(task({ createdById:"me", assigneeId:"other" }),"me","delegated")).toBe(true);
    expect(taskMatchesScope(task({ createdById:"me", assigneeId:null }),"me","delegated")).toBe(false);
  });
});
