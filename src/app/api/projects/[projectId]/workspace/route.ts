import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUserId } from "@/lib/team-permissions";
import { getProjectAccess } from "@/lib/project-permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const userId = await getRequestUserId(request);
  const { projectId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const access = await getProjectAccess(projectId, userId);
  if (!access?.canAccess)
    return NextResponse.json({ error: "无权访问该项目" }, { status: 403 });
  const [requirements, tasks, bugs, versions, releases, members] =
    await Promise.all([
      prisma.requirement.findMany({
        where: { projectId },
        include: {
          targetVersion: { select: { id: true, name: true } },
          _count: { select: { tasks: true, bugs: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.task.findMany({
        where: { projectId },
        include: {
          requirement: { select: { id: true, code: true, title: true } },
          version: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
          coordinator: { select: { id: true, name: true } },
          acceptor: { select: { id: true, name: true } },
          dependencies: { select: { dependsOnId: true } },
          _count: { select: { reports: true, bugs: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.bug.findMany({
        where: { projectId },
        include: {
          requirement: { select: { id: true, code: true, title: true } },
          task: { select: { id: true, code: true, title: true } },
          foundVersion: { select: { id: true, name: true } },
          fixedVersion: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.version.findMany({
        where: { projectId },
        include: {
          _count: {
            select: {
              requirements: true,
              tasks: true,
              fixedBugs: true,
              releases: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.release.findMany({
        where: { projectId },
        include: { version: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.projectMember.findMany({
        where: { projectId },
        include: { user: { select: { id: true, name: true, phone: true } } },
        orderBy: { user: { name: "asc" } },
      }),
    ]);
  return NextResponse.json({
    requirements,
    tasks,
    bugs,
    versions,
    releases,
    members: members.map((x) => ({ ...x.user, role: x.role })),
    permissions: {
      canWrite: Boolean(
        access.canManage ||
        (access.projectMember && access.projectMember.role !== "GUEST"),
      ),
      canDelete: access.canManage,
    },
  });
}
