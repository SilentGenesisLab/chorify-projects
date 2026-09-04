import { describe, expect, it } from "vitest";
import { canViewUsageDetails, collectorStatus } from "@/lib/usage-analytics";

describe("team AI usage privacy", () => {
  it("honors member visibility without leaking SELF details to managers", () => {
    expect(canViewUsageDetails("me", "me", "MEMBER", "SELF")).toBe(true);
    expect(canViewUsageDetails("admin", "member", "ADMIN", "SELF")).toBe(false);
    expect(canViewUsageDetails("admin", "member", "ADMIN", "MANAGERS")).toBe(true);
    expect(canViewUsageDetails("peer", "member", "MEMBER", "TEAM")).toBe(true);
  });

  it("classifies collector health", () => {
    expect(collectorStatus([])).toBe("UNCONNECTED");
    expect(collectorStatus([{ lastSeenAt: null, lastStatus: "REGISTERED", revokedAt: null }])).toBe("PENDING");
    expect(collectorStatus([{ lastSeenAt: new Date(), lastStatus: "HEALTHY", revokedAt: null }])).toBe("HEALTHY");
    expect(collectorStatus([{ lastSeenAt: new Date(), lastStatus: "ERROR", revokedAt: null }])).toBe("ERROR");
  });
});
