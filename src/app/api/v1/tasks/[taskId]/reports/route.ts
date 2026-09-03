import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { authenticatedUserId } from "@/lib/web-auth";
import { validateTaskStatusTransition } from "@/lib/task-workflow";

const schema = z.object({ summary: z.string().min(5), completedItems: z.array(z.string()).min(1), verification: z.string().min(3), remainingIssues: z.array(z.string()).default([]), needsSupport: z.array(z.string()).default([]) });
async function submit(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const userId = await authenticatedUserId(request); const { taskId } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "汇报内容不完整", details: parsed.error.flatten() }, { status: 400 });
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!userId || !task || task.assigneeId !== userId) return NextResponse.json({ error: "只能提交自己的任务" }, { status: 403 });
  const transitionError = validateTaskStatusTransition(task, userId, false, "PENDING_ACCEPTANCE");
  if (transitionError) return NextResponse.json({ error: transitionError.error }, { status: transitionError.status });
  const report = await prisma.$transaction(async (tx) => { const created = await tx.workReport.create({ data: { taskId, authorId: userId, ...parsed.data } }); await tx.task.update({ where: { id: taskId }, data: { status: "PENDING_ACCEPTANCE" } }); await tx.auditLog.create({ data: { userId, actorType: "USER", action: "SUBMIT_REPORT", resource: "TASK", resourceId: taskId, channel: "WEB", metadata: { projectId: task.projectId, result: "SUCCESS" } } }); return created; });
  return NextResponse.json({ report }, { status: 201 });
}
export const POST = apiRoute("task:report", submit, { idempotent: true });
