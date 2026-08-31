import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptTeamInviteToken } from "@/lib/security";
import { getAppOrigin } from "@/lib/app-url";
import { canCreateTeamProject, getRequestUserId, getTeamMembership, isTeamManager, maskedPhone, TEAM_ROLE_LABELS } from "@/lib/team-permissions";
import { z } from "zod";

export async function GET(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { teamId } = await params;
  const membership = await getTeamMembership(teamId, userId);
  if (!membership) return NextResponse.json({ error: "你不是该团队成员" }, { status: 403 });
  const canManage = isTeamManager(membership.role);
  const team = await prisma.team.findUnique({ where: { id: teamId }, include: {
    members: { orderBy: [{ role: "asc" }, { joinedAt: "asc" }], include: { user: { select: { id: true, name: true, phone: true, avatarColor: true } } } },
    projects: { where: canManage ? {} : { members: { some: { userId } } }, orderBy: { updatedAt: "desc" }, include: { _count: { select: { members: true, tasks: true } } } },
  } });
  if (!team) return NextResponse.json({ error: "团队不存在" }, { status: 404 });
  const invites = canManage ? await prisma.teamInvite.findMany({ where: { teamId }, orderBy: { createdAt: "desc" }, include: { createdBy: { select: { name: true } } } }) : [];
  return NextResponse.json({ team: {
    id: team.id, name: team.name, description: team.description, mission: team.mission, responsibilities: team.responsibilities, createdAt: team.createdAt,
    currentRole: membership.role, currentRoleLabel: TEAM_ROLE_LABELS[membership.role],
    permissions: { canManage, canInviteAdmin: membership.role === "OWNER", canCreateProject: canCreateTeamProject(membership.role) },
    members: team.members.map((item) => ({ id: item.id, userId: item.userId, name: item.displayName || item.user.name, accountName: item.user.name, displayName: item.displayName, phone: maskedPhone(item.user.phone), avatarColor: item.user.avatarColor, role: item.role, roleLabel: TEAM_ROLE_LABELS[item.role], title: item.title, responsibility: item.responsibility, bio: item.bio, joinedAt: item.joinedAt })),
    projects: team.projects.map((project) => ({ id: project.id, code: project.code, name: project.name, description: project.description, status: project.status, memberCount: project._count.members, taskCount: project._count.tasks, updatedAt: project.updatedAt })),
    invites: invites.map((invite) => {
      const token = invite.tokenCiphertext ? decryptTeamInviteToken(invite.tokenCiphertext) : null;
      return { id: invite.id, prefix: invite.prefix, url: token ? `${getAppOrigin(request)}/invite/${token}` : null, role: invite.role, roleLabel: TEAM_ROLE_LABELS[invite.role], maxUses: invite.maxUses, useCount: invite.useCount, expiresAt: invite.expiresAt, revokedAt: invite.revokedAt, createdAt: invite.createdAt, createdBy: invite.createdBy.name };
    }),
  } });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { teamId } = await params;
  const membership = await getTeamMembership(teamId, userId);
  if (!membership || !isTeamManager(membership.role)) return NextResponse.json({ error: "没有团队管理权限" }, { status: 403 });
  const parsed = z.object({ name: z.string().trim().min(2).max(40), description: z.string().trim().max(2000), mission: z.string().trim().max(500), responsibilities: z.string().trim().max(2000) }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "请检查团队资料长度" }, { status: 400 });
  const team = await prisma.$transaction(async (tx) => {
    const updated = await tx.team.update({ where: { id: teamId }, data: parsed.data });
    await tx.auditLog.create({ data: { userId, actorType: "USER", action: "UPDATE_TEAM_PROFILE", resource: "TEAM", resourceId: teamId, channel: "WEB", metadata: { teamId } } });
    return updated;
  });
  return NextResponse.json({ team });
}
