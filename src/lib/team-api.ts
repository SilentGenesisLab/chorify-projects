import { NextRequest, NextResponse } from "next/server";
import { getRequestUserId, getTeamMembership, isTeamManager } from "@/lib/team-permissions";

export async function teamAccess(request: NextRequest, teamId: string, manager = false) {
  const userId = await getRequestUserId(request);
  if (!userId) return { error: NextResponse.json({ error: "请先登录" }, { status: 401 }) };
  const membership = await getTeamMembership(teamId, userId);
  if (!membership || (manager && !isTeamManager(membership.role))) return { error: NextResponse.json({ error: manager ? "没有团队管理权限" : "你不是该团队成员" }, { status: 403 }) };
  return { userId, membership };
}
