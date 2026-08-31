import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canCreateTeamProject, getRequestUserId, isRateLimited } from "@/lib/team-permissions";

export async function GET(request: NextRequest) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const [teams, projects] = await Promise.all([
    prisma.teamMember.findMany({ where: { userId, role: { in: ["OWNER", "ADMIN", "MEMBER"] } }, include: { team: { select: { id: true, name: true } } }, orderBy: { joinedAt: "desc" } }),
    prisma.project.findMany({ where: { OR: [{ team: { members: { some: { userId, role: { in: ["OWNER", "ADMIN"] } } } } }, { members: { some: { userId } } }] }, include: { team: { select: { id: true, name: true, members: { where: { userId }, select: { role: true } } } }, members: { where: { userId }, select: { role: true } }, _count: { select: { members: true, tasks: true } } }, orderBy: { updatedAt: "desc" } }),
  ]);
  return NextResponse.json({ teams: teams.map((item) => item.team), projects: projects.map((item) => {
    const projectRole = item.members[0]?.role;
    const teamRole = item.team.members[0]?.role;
    return { id: item.id, code: item.code, name: item.name, description: item.description, status: item.status, startDate: item.startDate, endDate: item.endDate, team: { id: item.team.id, name: item.team.name }, memberCount: item._count.members, taskCount: item._count.tasks, canManage: projectRole === "OWNER" || projectRole === "MANAGER" || teamRole === "OWNER" || teamRole === "ADMIN", canDelete: projectRole === "OWNER" || teamRole === "OWNER" || teamRole === "ADMIN", updatedAt: item.updatedAt };
  }) });
}

export async function POST(request: NextRequest) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const input = z.object({ teamId: z.string().min(1), name: z.string().trim().min(2).max(60), code: z.string().trim().min(2).max(12).regex(/^[A-Za-z][A-Za-z0-9_-]*$/), description: z.string().trim().max(300).optional() }).safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message || "项目信息不完整" }, { status: 400 });
  const membership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId: input.data.teamId, userId } } });
  if (!membership || !canCreateTeamProject(membership.role)) return NextResponse.json({ error: "只有团队正式成员可以新建项目" }, { status: 403 });
  if (await isRateLimited(userId, "CREATE_PROJECT", 8)) return NextResponse.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
  const code = input.data.code.toUpperCase();
  if (await prisma.project.findUnique({ where: { code } })) return NextResponse.json({ error: "项目标识已被使用" }, { status: 409 });
  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({ data: { teamId: input.data.teamId, name: input.data.name, code, description: input.data.description || "", members: { create: { userId, role: "OWNER", responsibility: "项目负责人" } } } });
    await tx.auditLog.create({ data: { userId, actorType: "USER", action: "CREATE_PROJECT", resource: "PROJECT", resourceId: created.id, channel: "WEB", metadata: { teamId: created.teamId, code } } });
    return created;
  });
  return NextResponse.json({ project }, { status: 201 });
}
