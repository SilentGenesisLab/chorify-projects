import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUserId, getTeamMembership, isRateLimited } from "@/lib/team-permissions";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ teamId: string; inviteId: string }> }) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { teamId, inviteId } = await params;
  const membership = await getTeamMembership(teamId, userId);
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) return NextResponse.json({ error: "没有管理邀请的权限" }, { status: 403 });
  const invite = await prisma.teamInvite.findFirst({ where: { id: inviteId, teamId } });
  if (!invite) return NextResponse.json({ error: "邀请不存在" }, { status: 404 });
  if (invite.role === "ADMIN" && membership.role !== "OWNER") return NextResponse.json({ error: "只有团队所有者可以撤销管理员邀请" }, { status: 403 });
  if (await isRateLimited(userId, "REVOKE_TEAM_INVITE")) return NextResponse.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
  await prisma.$transaction(async (tx) => {
    await tx.teamInvite.update({ where: { id: inviteId }, data: { revokedAt: new Date() } });
    await tx.auditLog.create({ data: { userId, actorType: "USER", action: "REVOKE_TEAM_INVITE", resource: "TEAM_INVITE", resourceId: inviteId, channel: "WEB", metadata: { teamId } } });
  });
  return NextResponse.json({ ok: true });
}
