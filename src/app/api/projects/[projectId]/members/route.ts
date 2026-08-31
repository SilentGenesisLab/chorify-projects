import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUserId, isRateLimited, maskedPhone, TEAM_ROLE_LABELS } from "@/lib/team-permissions";
import { getProjectAccess, PROJECT_ROLE_LABELS } from "@/lib/project-permissions";

const userSelect = {
  id: true,
  name: true,
  phone: true,
  avatarColor: true,
} as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { projectId } = await params;
  const access = await getProjectAccess(projectId, userId);
  if (!access?.canAccess) return NextResponse.json({ error: "项目不存在或无权访问" }, { status: 403 });
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: {
        include: { user: { select: userSelect } },
        orderBy: { role: "asc" },
      },
      team: { select: { id: true, name: true } },
    },
  });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  const candidates = project.teamId
    ? (
        await prisma.teamMember.findMany({
          where: { teamId: project.teamId },
          include: { user: { select: userSelect } },
          orderBy: { joinedAt: "asc" },
        })
      ).map((member) => ({
        user: member.user,
        teamRole: member.role,
        teamRoleLabel: TEAM_ROLE_LABELS[member.role],
      }))
    : query.length >= 2
      ? (
          await prisma.user.findMany({
            where: {
              OR: [{ name: { contains: query, mode: "insensitive" } }, { phone: { contains: query } }],
            },
            select: userSelect,
            orderBy: { name: "asc" },
            take: 20,
          })
        ).map((user) => ({ user, teamRole: null, teamRoleLabel: "平台用户" }))
      : [];
  const projectUserIds = new Set(project.members.map((member) => member.userId));
  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      scope: project.teamId ? "TEAM" : "PERSONAL",
      team: project.team,
    },
    permissions: {
      canManage: access.canManage,
      canAssignManagers: access.canAssignManagers,
    },
    members: project.members.map((member) => ({
      id: member.id,
      userId: member.userId,
      name: member.user.name,
      phone: maskedPhone(member.user.phone),
      avatarColor: member.user.avatarColor,
      role: member.role,
      roleLabel: PROJECT_ROLE_LABELS[member.role],
      responsibility: member.responsibility,
    })),
    teamMembers: candidates.map((candidate) => ({
      userId: candidate.user.id,
      name: candidate.user.name,
      phone: maskedPhone(candidate.user.phone),
      avatarColor: candidate.user.avatarColor,
      teamRole: candidate.teamRole,
      teamRoleLabel: candidate.teamRoleLabel,
      inProject: projectUserIds.has(candidate.user.id),
    })),
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { projectId } = await params;
  const access = await getProjectAccess(projectId, userId);
  if (!access?.canManage) return NextResponse.json({ error: "没有项目成员管理权限" }, { status: 403 });
  const input = z
    .object({
      userIds: z.array(z.string().min(1)).min(1).max(50),
      role: z.enum(["OWNER", "MANAGER", "MEMBER", "GUEST"]),
      responsibility: z.string().trim().max(120).optional(),
    })
    .safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: "请选择要加入的成员" }, { status: 400 });
  if ((input.data.role === "OWNER" || input.data.role === "MANAGER") && !access.canAssignManagers) {
    return NextResponse.json({ error: "只有项目所有者或团队管理员可以设置项目管理角色" }, { status: 403 });
  }
  if (await isRateLimited(userId, "ADD_PROJECT_MEMBERS", 12)) return NextResponse.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
  const uniqueUserIds = [...new Set(input.data.userIds)];
  const eligible = access.project.teamId
    ? await prisma.teamMember.findMany({
        where: { teamId: access.project.teamId, userId: { in: uniqueUserIds } },
        select: { userId: true },
      })
    : await prisma.user.findMany({
        where: { id: { in: uniqueUserIds } },
        select: { id: true },
      });
  const eligibleIds = new Set(eligible.map((item) => ("userId" in item ? item.userId : item.id)));
  if (eligibleIds.size !== uniqueUserIds.length)
    return NextResponse.json(
      {
        error: access.project.teamId ? "只能从项目所属团队中添加成员" : "所选用户不存在",
      },
      { status: 400 },
    );
  const existing = await prisma.projectMember.findMany({
    where: { projectId, userId: { in: uniqueUserIds } },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map((member) => member.userId));
  const newUserIds = uniqueUserIds.filter((id) => !existingIds.has(id));
  if (!newUserIds.length) return NextResponse.json({ error: "所选成员已在项目中" }, { status: 409 });
  await prisma.$transaction(async (tx) => {
    await tx.projectMember.createMany({
      data: newUserIds.map((memberUserId) => ({
        projectId,
        userId: memberUserId,
        role: input.data.role,
        responsibility: input.data.responsibility || null,
      })),
    });
    await tx.auditLog.create({
      data: {
        userId,
        actorType: "USER",
        action: "ADD_PROJECT_MEMBERS",
        resource: "PROJECT",
        resourceId: projectId,
        channel: "WEB",
        metadata: {
          teamId: access.project.teamId,
          scope: access.project.teamId ? "TEAM" : "PERSONAL",
          memberUserIds: newUserIds,
          role: input.data.role,
        },
      },
    });
  });
  return NextResponse.json({ added: newUserIds.length }, { status: 201 });
}
