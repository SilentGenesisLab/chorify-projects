import { describe, expect, it } from "vitest";
import {
  dashboardTaskSort,
  isOpenTask,
  isShanghaiDay,
  selectDashboardVersion,
  shanghaiMonth,
} from "./dashboard";

describe("dashboard calculations", () => {
  it("uses Shanghai calendar boundaries", () => {
    const now = new Date("2026-08-31T16:30:00Z");
    expect(shanghaiMonth(now)).toBe("2026-09");
    expect(isShanghaiDay(new Date("2026-08-31T16:01:00Z"), now)).toBe(true);
  });

  it("treats accepted and done tasks as terminal", () => {
    expect(isOpenTask("IN_PROGRESS")).toBe(true);
    expect(isOpenTask("ACCEPTED")).toBe(false);
    expect(isOpenTask("DONE")).toBe(false);
  });

  it("sorts overdue first and missing due dates last", () => {
    const now = new Date("2026-08-28T04:00:00Z");
    const tasks = [
      { id: "none", dueAt: null, priority: "URGENT" },
      { id: "future", dueAt: new Date("2026-08-29T04:00:00Z"), priority: "LOW" },
      { id: "late", dueAt: new Date("2026-08-27T04:00:00Z"), priority: "LOW" },
    ].sort((a, b) => dashboardTaskSort(a, b, now));
    expect(tasks.map((task) => task.id)).toEqual(["late", "future", "none"]);
  });

  it("selects the nearest future active version", () => {
    const now = new Date("2026-08-28T04:00:00Z");
    const versions = [
      { status: "RELEASED", plannedAt: new Date("2026-08-29"), updatedAt: now },
      { status: "TESTING", plannedAt: new Date("2026-09-10"), updatedAt: now },
      { status: "PLANNING", plannedAt: new Date("2026-09-02"), updatedAt: now },
    ];
    expect(selectDashboardVersion(versions, now)?.status).toBe("PLANNING");
  });
});
