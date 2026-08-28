import { describe, expect, it } from "vitest";
import { weekRange } from "./weekly-report";

describe("weekly report calendar", () => {
  it("normalizes a date to Shanghai Monday", () => {
    const range = weekRange("2026-08-28");
    expect(range?.startLabel).toBe("2026-08-24");
    expect(range?.start.toISOString()).toBe("2026-08-23T16:00:00.000Z");
    expect(range?.end.toISOString()).toBe("2026-08-30T15:59:59.999Z");
  });

  it("rejects invalid dates", () => {
    expect(weekRange("2026-02-31")).toBeNull();
  });
});
