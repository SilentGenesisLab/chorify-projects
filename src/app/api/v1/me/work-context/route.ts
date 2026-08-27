import { NextResponse } from "next/server";
import { authenticateApi } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await authenticateApi(request, "task:read");
  if (!auth) return NextResponse.json({ error: "无效或已过期的 API Key" }, { status: 401 });
  const memberships = await prisma.projectMember.findMany({ where: { userId: auth.userId }, select: { projectId: true } });
  const scopedIds = auth.allProjects ? memberships.map((item) => item.projectId) : auth.projects.map((item) => item.projectId).filter((id) => memberships.some((item) => item.projectId === id));
  const tasks = await prisma.task.findMany({
    where: { assigneeId: auth.userId, projectId: { in: scopedIds } },
    include: { project: { select: { code: true, name: true } }, coordinator: { select: { id: true, name: true } }, acceptor: { select: { id: true, name: true } }, dependencies: { include: { dependsOn: { select: { code: true, title: true, status: true } } } }, version: { select: { name: true } } },
    orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
  });
  return NextResponse.json({ user: { id: auth.user.id, name: auth.user.name }, generatedAt: new Date(), tasks });
}
