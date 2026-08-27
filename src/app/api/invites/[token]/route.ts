import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/security";
import { getRequestUserId, TEAM_ROLE_LABELS } from "@/lib/team-permissions";

function inviteState(invite: { revokedAt: Date | null; expiresAt: Date; useCount: number; maxUses: number }) {
  if (invite.revokedAt) return { valid: false, reason: "该邀请链接已被撤销" };
  if (invite.expiresAt <= new Date()) return { valid: false, reason: "该邀请链接已过期" };
  if (invite.useCount >= invite.maxUses) return { valid: false, reason: "该邀请链接已达到人数上限" };
  return { valid: true, reason: null };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await prisma.teamInvite.findUnique({ where: { tokenHash: sha256(token) }, include: { team: { select: { id: true, name: true, description: true, _count: { select: { members: true, projects: true } } } }, createdBy: { select: { name: true } } } });
  if (!invite) return NextResponse.json({ error: "邀请链接无效" }, { status: 404 });
  const userId = await getRequestUserId(request);
  const existing = userId ? await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId: invite.teamId, userId } } }) : null;
  return NextResponse.json({ invite: { ...inviteState(invite), team: { id: invite.team.id, name: invite.team.name, description: invite.team.description, memberCount: invite.team._count.members, projectCount: invite.team._count.projects }, role: invite.role, roleLabel: TEAM_ROLE_LABELS[invite.role], expiresAt: invite.expiresAt, createdBy: invite.createdBy.name, authenticated: Boolean(userId), alreadyMember: Boolean(existing) } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { token } = await params;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "TeamInvite" WHERE "tokenHash" = ${sha256(token)} FOR UPDATE`;
      if (!rows.length) throw new Error("NOT_FOUND");
      const invite = await tx.teamInvite.findUnique({ where: { id: rows[0].id } });
      if (!invite) throw new Error("NOT_FOUND");
      const state = inviteState(invite);
      const existing = await tx.teamMember.findUnique({ where: { teamId_userId: { teamId: invite.teamId, userId } } });
      if (existing) return { teamId: invite.teamId, alreadyMember: true };
      if (!state.valid) throw new Error(state.reason || "邀请不可用");
      await tx.teamMember.create({ data: { teamId: invite.teamId, userId, role: invite.role } });
      await tx.teamInvite.update({ where: { id: invite.id }, data: { useCount: { increment: 1 } } });
      await tx.auditLog.create({ data: { userId, actorType: "USER", action: "ACCEPT_TEAM_INVITE", resource: "TEAM", resourceId: invite.teamId, channel: "WEB", metadata: { inviteId: invite.id, role: invite.role } } });
      return { teamId: invite.teamId, alreadyMember: false };
    });
    return NextResponse.json(result);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "加入团队失败";
    if (message === "NOT_FOUND") return NextResponse.json({ error: "邀请链接无效" }, { status: 404 });
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
