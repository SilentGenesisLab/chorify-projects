import { describe, expect, it } from "vitest";
import { projectWeek } from "./project-activity";

describe("project activity week boundaries", () => {
  it("uses Monday to Sunday in Asia/Shanghai", () => {
    const week = projectWeek("2026-09-03");
    expect(week.key).toBe("2026-08-31");
    expect(week.start.toISOString()).toBe("2026-08-30T16:00:00.000Z");
    expect(week.end.toISOString()).toBe("2026-09-06T16:00:00.000Z");
  });

  it("handles year boundaries", () => {
    expect(projectWeek("2027-01-01").key).toBe("2026-12-28");
  });

  it("rejects malformed week input", () => {
    expect(() => projectWeek("not-a-date")).toThrow("周日期格式无效");
  });
});
