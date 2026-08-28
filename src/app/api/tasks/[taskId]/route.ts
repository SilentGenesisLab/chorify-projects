import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUserId } from "@/lib/team-permissions";
import { getProjectAccess } from "@/lib/project-permissions";

export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { taskId } = await params;
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: {
    project: { select: { id: true, name: true, code: true } }, requirement: { select: { id: true, code: true, title: true } }, version: { select: { id: true, name: true } },
    assignee: { select: { id: true, name: true } }, coordinator: { select: { id: true, name: true } }, acceptor: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } },
    dependencies: { include: { dependsOn: { select: { id: true, code: true, title: true, status: true } } } },
    reports: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } }, acceptances: { include: { reviewer: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
  } });
  if (!task || !(await getProjectAccess(task.projectId, userId))?.canAccess) return NextResponse.json({ error: "任务不存在或无权访问" }, { status: 404 });
  const access = await getProjectAccess(task.projectId, userId);
  return NextResponse.json({ task, permissions: { canWrite: Boolean(access?.canManage || (access?.projectMember && access.projectMember.role !== "GUEST")) } });
}
