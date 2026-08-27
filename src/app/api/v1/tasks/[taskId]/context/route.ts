import { NextResponse } from "next/server";
import { authenticateApi, tokenCanAccessProject } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const auth = await authenticateApi(request, "task:read"); const { taskId } = await params;
  if (!auth) return NextResponse.json({ error: "未授权" }, { status: 401 });
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true, requirement: true, version: true, assignee: { select: { id: true, name: true } }, coordinator: { select: { id: true, name: true } }, acceptor: { select: { id: true, name: true } }, dependencies: { include: { dependsOn: true } }, reports: { orderBy: { createdAt: "desc" } } } });
  if (!task || !await tokenCanAccessProject(auth, task.projectId)) return NextResponse.json({ error: "无权访问该任务" }, { status: 403 });
  return NextResponse.json(task);
}
