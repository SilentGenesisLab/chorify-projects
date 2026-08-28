import { NextResponse } from "next/server";
import { authenticateApi } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { auditApiCall } from "@/lib/api-audit";

export async function GET(request: Request) {
  const auth = await authenticateApi(request, "task:read");
  if (!auth) return NextResponse.json({ error: "无效或已过期的 API Key" }, { status: 401 });
  const projects = await prisma.project.findMany({
    where: { OR: [
      { members: { some: { userId: auth.userId } } },
      { team: { members: { some: { userId: auth.userId, role: { in: ["OWNER", "ADMIN"] } } } } },
    ] },
    select: { id: true },
  });
  const scopedIds = projects.map((project) => project.id);
  const tasks = await prisma.task.findMany({
    where: { assigneeId: auth.userId, projectId: { in: scopedIds } },
    include: { project: { select: { code: true, name: true } }, coordinator: { select: { id: true, name: true } }, acceptor: { select: { id: true, name: true } }, dependencies: { include: { dependsOn: { select: { code: true, title: true, status: true } } } }, version: { select: { name: true } } },
    orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
  });
  await auditApiCall({ auth, action: "READ_WORK_CONTEXT", resource: "TASK", request, details: { taskCount: tasks.length, projectCount: scopedIds.length } });
  return NextResponse.json({ user: { id: auth.user.id, name: auth.user.name }, generatedAt: new Date(), tasks });
}
