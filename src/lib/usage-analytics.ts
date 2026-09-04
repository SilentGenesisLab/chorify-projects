import type { AiUsageVisibility, TeamRole } from "@prisma/client";

export type UsageRange = "today" | "yesterday" | "7d" | "month";

export function shanghaiStart(offsetDays = 0) {
  const local = new Date(Date.now() + 8 * 3_600_000);
  local.setUTCHours(0, 0, 0, 0);
  local.setUTCDate(local.getUTCDate() + offsetDays);
  return new Date(local.getTime() - 8 * 3_600_000);
}

export function usageRangeBounds(range: UsageRange) {
  const end = shanghaiStart(1);
  if (range === "today") return { start: shanghaiStart(), end };
  if (range === "yesterday") return { start: shanghaiStart(-1), end: shanghaiStart() };
  if (range === "7d") return { start: shanghaiStart(-6), end };
  const local = new Date(Date.now() + 8 * 3_600_000);
  return { start: new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - 8 * 3_600_000), end };
}

export function canViewUsageDetails(viewerId: string, targetId: string, viewerRole: TeamRole, visibility: AiUsageVisibility) {
  if (viewerId === targetId) return true;
  if (visibility === "TEAM") return viewerRole !== "GUEST";
  if (visibility === "MANAGERS") return viewerRole === "OWNER" || viewerRole === "ADMIN";
  return false;
}

export function collectorStatus(devices: Array<{ lastSeenAt: Date | null; lastStatus: string; revokedAt: Date | null }>, now = Date.now()) {
  const active = devices.filter((item) => !item.revokedAt);
  if (!active.length) return "UNCONNECTED" as const;
  const latest = active.sort((a, b) => (b.lastSeenAt?.getTime() || 0) - (a.lastSeenAt?.getTime() || 0))[0];
  if (latest.lastStatus === "ERROR") return "ERROR" as const;
  if (!latest.lastSeenAt) return "PENDING" as const;
  return now - latest.lastSeenAt.getTime() <= 90 * 60_000 ? "HEALTHY" as const : "OFFLINE" as const;
}
