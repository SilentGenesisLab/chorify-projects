import { describe, expect, it } from "vitest";
import {
  buildCompletionTrend,
  calculateProjectProgress,
  nextTaskCompletedAt,
  selectCurrentVersion,
} from "./project-overview";

describe("project overview calculations", () => {
  it("redistributes empty category weights", () => {
    const result = calculateProjectProgress({
      requirements: [{ status: "DONE" }],
      tasks: [{ status: "IN_PROGRESS" }],
      bugs: [],
      milestones: [],
    });
    expect(result.overall).toBe(54);
    expect(result.breakdown.tasks.value).toBe(35);
  });

  it("excludes rejected bugs and cancelled milestones", () => {
    const result = calculateProjectProgress({
      requirements: [],
      tasks: [],
      bugs: [{ status: "REJECTED" }],
      milestones: [{ status: "CANCELLED" }],
    });
    expect(result.overall).toBe(0);
    expect(result.breakdown.bugs.available).toBe(false);
  });

  it("preserves the first completion date until a task is reopened", () => {
    const first = new Date("2026-08-28T01:00:00Z");
    const later = new Date("2026-08-29T01:00:00Z");
    expect(nextTaskCompletedAt("DONE", first, later)).toBe(first);
    expect(nextTaskCompletedAt("IN_PROGRESS", first, later)).toBeNull();
  });

  it("groups daily completions using Shanghai calendar dates", () => {
    const trend = buildCompletionTrend(
      2,
      [new Date("2026-08-27T16:30:00Z")],
      new Date("2026-08-28T03:00:00Z"),
    );
    expect(trend).toEqual([
      { date: "2026-08-27", count: 0 },
      { date: "2026-08-28", count: 1 },
    ]);
  });

  it("selects an active version before planning or released versions", () => {
    const current = selectCurrentVersion([
      { status: "RELEASED", updatedAt: new Date("2026-08-30") },
      { status: "DEVELOPING", updatedAt: new Date("2026-08-20") },
    ]);
    expect(current?.status).toBe("DEVELOPING");
  });
});
