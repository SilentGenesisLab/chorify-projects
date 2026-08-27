import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUserId, isRateLimited, maskedPhone, TEAM_ROLE_LABELS } from "@/lib/team-permissions";
import { getProjectAccess, PROJECT_ROLE_LABELS } from "@/lib/project-permissions";

export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { projectId } = await params;
  const access = await getProjectAccess(projectId, userId);
  if (!access?.canAccess) return NextResponse.json({ error: "项目不存在或无权访问" }, { status: 403 });
  const [project, teamMembers] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, include: { members: { include: { user: { select: { id: true, name: true, phone: true, avatarColor: true } } }, orderBy: { role: "asc" } }, team: { select: { id: true, name: true } } } }),
    prisma.teamMember.findMany({ where: { teamId: access.project.teamId }, include: { user: { select: { id: true, name: true, phone: true, avatarColor: true } } }, orderBy: { joinedAt: "asc" } }),
  ]);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  const projectUserIds = new Set(project.members.map((member) => member.userId));
  return NextResponse.json({
    project: { id: project.id, name: project.name, team: project.team },
    permissions: { canManage: access.canManage, canAssignManagers: access.canAssignManagers },
    members: project.members.map((member) => ({ id: member.id, userId: member.userId, name: member.user.name, phone: maskedPhone(member.user.phone), avatarColor: member.user.avatarColor, role: member.role, roleLabel: PROJECT_ROLE_LABELS[member.role], responsibility: member.responsibility })),
    teamMembers: teamMembers.map((member) => ({ userId: member.userId, name: member.user.name, phone: maskedPhone(member.user.phone), avatarColor: member.user.avatarColor, teamRole: member.role, teamRoleLabel: TEAM_ROLE_LABELS[member.role], inProject: projectUserIds.has(member.userId) })),
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { projectId } = await params;
  const access = await getProjectAccess(projectId, userId);
  if (!access?.canManage) return NextResponse.json({ error: "没有项目成员管理权限" }, { status: 403 });
  const input = z.object({ userIds: z.array(z.string().min(1)).min(1).max(50), role: z.enum(["OWNER", "MANAGER", "MEMBER", "GUEST"]), responsibility: z.string().trim().max(120).optional() }).safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message || "请选择要拉入的团队成员" }, { status: 400 });
  if ((input.data.role === "OWNER" || input.data.role === "MANAGER") && !access.canAssignManagers) return NextResponse.json({ error: "只有项目所有者或团队管理员可以设置项目管理角色" }, { status: 403 });
  if (await isRateLimited(userId, "ADD_PROJECT_MEMBERS", 12)) return NextResponse.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
  const uniqueUserIds = [...new Set(input.data.userIds)];
  const eligible = await prisma.teamMember.findMany({ where: { teamId: access.project.teamId, userId: { in: uniqueUserIds } }, select: { userId: true } });
  if (eligible.length !== uniqueUserIds.length) return NextResponse.json({ error: "只能从项目所属团队中拉入成员" }, { status: 400 });
  const existing = await prisma.projectMember.findMany({ where: { projectId, userId: { in: uniqueUserIds } }, select: { userId: true } });
  const existingIds = new Set(existing.map((member) => member.userId));
  const newUserIds = uniqueUserIds.filter((id) => !existingIds.has(id));
  if (!newUserIds.length) return NextResponse.json({ error: "所选成员已在项目中" }, { status: 409 });
  await prisma.$transaction(async (tx) => {
    await tx.projectMember.createMany({ data: newUserIds.map((memberUserId) => ({ projectId, userId: memberUserId, role: input.data.role, responsibility: input.data.responsibility || null })) });
    await tx.auditLog.create({ data: { userId, actorType: "USER", action: "ADD_PROJECT_MEMBERS", resource: "PROJECT", resourceId: projectId, channel: "WEB", metadata: { teamId: access.project.teamId, memberUserIds: newUserIds, role: input.data.role } } });
  });
  return NextResponse.json({ added: newUserIds.length }, { status: 201 });
}
