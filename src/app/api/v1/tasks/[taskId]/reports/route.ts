import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApi } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const reportSchema = z.object({ summary: z.string().min(5), completedItems: z.array(z.string()).min(1), verification: z.string().min(3), remainingIssues: z.array(z.string()).default([]), needsSupport: z.array(z.string()).default([]) });
export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const auth = await authenticateApi(request, true); const { taskId } = await params;
  if (!auth) return NextResponse.json({ error: "需要工作权限" }, { status: 401 });
  const parsed = reportSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "汇报内容不完整", details: parsed.error.flatten() }, { status: 400 });
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.assigneeId !== auth.userId || (auth.projectId && auth.projectId !== task.projectId)) return NextResponse.json({ error: "只能提交自己的授权任务" }, { status: 403 });
  const [report] = await prisma.$transaction([
    prisma.workReport.create({ data: { taskId, authorId: auth.userId, ...parsed.data } }),
    prisma.task.update({ where: { id: taskId }, data: { status: "PENDING_ACCEPTANCE" } }),
    prisma.auditLog.create({ data: { userId: auth.userId, actorType: "USER", action: "SUBMIT_REPORT", resource: "TASK", resourceId: taskId, channel: "CODEX_API" } }),
  ]);
  return NextResponse.json(report, { status: 201 });
}
