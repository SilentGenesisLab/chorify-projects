import { describe, expect, it } from "vitest";
import { createsDependencyCycle, hasDependencyConflict, naturalDays, nextStartedAt, scheduleHealth, validateSchedule } from "./project-schedule";

describe("project schedule", () => {
  it("counts inclusive Shanghai natural days across weeks, months and years", () => {
    expect(naturalDays("2026-09-04T23:00:00+08:00", "2026-09-07T01:00:00+08:00")).toBe(4);
    expect(naturalDays("2026-12-31T10:00:00+08:00", "2027-01-01T10:00:00+08:00")).toBe(2);
    expect(naturalDays("2026-09-08T01:00:00+08:00", "2026-09-08T23:00:00+08:00")).toBe(1);
  });

  it("only records the first actual start", () => {
    const now = new Date("2026-09-08T09:00:00+08:00");
    expect(nextStartedAt(null, "TODO", "IN_PROGRESS", "task", now)).toEqual(now);
    expect(nextStartedAt(now, "IN_PROGRESS", "NEEDS_CHANGES", "task", new Date())).toEqual(now);
    expect(nextStartedAt(null, "APPROVED", "DEVELOPING", "requirement", now)).toEqual(now);
  });

  it("classifies overdue and dependency conflicts", () => {
    const now = new Date("2026-09-08T12:00:00+08:00");
    expect(scheduleHealth({ status: "IN_PROGRESS", dueAt: new Date("2026-09-07T18:00:00+08:00"), closedAt: null }, now)).toBe("OVERDUE");
    expect(hasDependencyConflict({ plannedStartAt: now, dependencies: [{ dependsOn: { dueAt: new Date("2026-09-09T18:00:00+08:00"), status: "IN_PROGRESS" } }] })).toBe(true);
  });

  it("rejects reversed schedule ranges", () => {
    expect(validateSchedule("2026-09-09T00:00:00.000Z", "2026-09-08T00:00:00.000Z")).toMatch("不能早于");
    expect(validateSchedule(null, null)).toBeNull();
  });

  it("detects indirect dependency cycles", () => {
    expect(createsDependencyCycle("a", ["b"], [{ taskId: "b", dependsOnId: "c" }, { taskId: "c", dependsOnId: "a" }])).toBe(true);
    expect(createsDependencyCycle("a", ["b"], [{ taskId: "b", dependsOnId: "c" }])).toBe(false);
  });
});
