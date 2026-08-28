import type { TeamRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { SESSION_COOKIE, verifySessionToken } from "./session";
import { currentApiActor } from "@/lib/api-request-context";

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  OWNER: "团队所有者",
  ADMIN: "团队管理员",
  MEMBER: "团队成员",
  GUEST: "访客",
};

export const isTeamManager = (role: TeamRole) => role === "OWNER" || role === "ADMIN";

export async function getRequestUserId(request: NextRequest) {
  const apiActor = currentApiActor();
  if (apiActor && request.nextUrl.pathname.startsWith("/api/v1/")) return apiActor.userId;
  return verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
}

export async function getTeamMembership(teamId: string, userId: string) {
  return prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
}

export async function isRateLimited(userId: string, action: string, limit = 12) {
  const since = new Date(Date.now() - 60_000);
  return (await prisma.auditLog.count({ where: { userId, action, createdAt: { gte: since } } })) >= limit;
}

export function maskedPhone(phone: string) {
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}
