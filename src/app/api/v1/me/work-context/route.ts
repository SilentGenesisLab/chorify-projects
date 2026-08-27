import { NextResponse } from "next/server";
import { authenticateApi } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await authenticateApi(request);
  if (!auth) return NextResponse.json({ error: "无效或已过期的 API Key" }, { status: 401 });
  const tasks = await prisma.task.findMany({
    where: { assigneeId: auth.userId, ...(auth.projectId ? { projectId: auth.projectId } : {}) },
    include: { project: { select: { code: true, name: true } }, coordinator: { select: { id: true, name: true } }, acceptor: { select: { id: true, name: true } }, dependencies: { include: { dependsOn: { select: { code: true, title: true, status: true } } } }, version: { select: { name: true } } },
    orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
  });
  return NextResponse.json({ user: { id: auth.user.id, name: auth.user.name }, generatedAt: new Date(), tasks });
}
