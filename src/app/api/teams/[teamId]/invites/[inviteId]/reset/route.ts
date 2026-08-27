import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTeamInviteToken } from "@/lib/security";
import { getRequestUserId, getTeamMembership, isRateLimited } from "@/lib/team-permissions";

export async function POST(request: NextRequest, { params }: { params: Promise<{ teamId: string; inviteId: string }> }) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { teamId, inviteId } = await params;
  const membership = await getTeamMembership(teamId, userId);
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) return NextResponse.json({ error: "没有管理邀请的权限" }, { status: 403 });
  const current = await prisma.teamInvite.findFirst({ where: { id: inviteId, teamId } });
  if (!current) return NextResponse.json({ error: "邀请不存在" }, { status: 404 });
  if (current.role === "ADMIN" && membership.role !== "OWNER") return NextResponse.json({ error: "只有团队所有者可以重置管理员邀请" }, { status: 403 });
  if (await isRateLimited(userId, "RESET_TEAM_INVITE", 8)) return NextResponse.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
  const token = createTeamInviteToken();
  const invite = await prisma.$transaction(async (tx) => {
    const updated = await tx.teamInvite.update({ where: { id: inviteId }, data: { ...token, useCount: 0, revokedAt: null, expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
    await tx.auditLog.create({ data: { userId, actorType: "USER", action: "RESET_TEAM_INVITE", resource: "TEAM_INVITE", resourceId: inviteId, channel: "WEB", metadata: { teamId } } });
    return updated;
  });
  return NextResponse.json({ invite: { id: invite.id, token: token.token, url: `${request.nextUrl.origin}/invite/${token.token}`, prefix: invite.prefix, expiresAt: invite.expiresAt, maxUses: invite.maxUses, useCount: invite.useCount, role: invite.role } });
}
