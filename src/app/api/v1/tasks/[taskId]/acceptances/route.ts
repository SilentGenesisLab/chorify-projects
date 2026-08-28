import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/api-route";
import { getProjectAccess } from "@/lib/project-permissions";
import { prisma } from "@/lib/prisma";
import { authenticatedUserId } from "@/lib/web-auth";

const schema = z.object({ decision: z.enum(["PASS", "NEEDS_CHANGES"]), conclusion: z.string().trim().min(3).max(3000), verificationEvidence: z.string().trim().min(3).max(5000) });
async function accept(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const userId = await authenticatedUserId(request); const { taskId } = await params; const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "验收结论和验证证据不能为空", details: parsed.error.flatten() }, { status: 400 });
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!userId || !task) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  const access = await getProjectAccess(task.projectId, userId);
  if (task.acceptorId !== userId && !access?.canManage) return NextResponse.json({ error: "只有任务验收人或项目管理员可以验收" }, { status: 403 });
  if (task.status !== "PENDING_ACCEPTANCE") return NextResponse.json({ error: "任务当前不处于待验收状态" }, { status: 409 });
  const now = new Date(); const passed = parsed.data.decision === "PASS";
  const acceptance = await prisma.$transaction(async (tx) => { const created = await tx.acceptance.create({ data: { taskId, reviewerId: userId, result: parsed.data.decision, comment: parsed.data.conclusion, verification: parsed.data.verificationEvidence } }); await tx.task.update({ where: { id: taskId }, data: { status: passed ? "ACCEPTED" : "NEEDS_CHANGES", completedAt: passed ? now : null, closedAt: passed ? now : null } }); await tx.auditLog.create({ data: { userId, actorType: "USER", action: "ACCEPT_TASK", resource: "TASK", resourceId: taskId, channel: "WEB", metadata: { projectId: task.projectId, decision: parsed.data.decision, result: "SUCCESS" } } }); return created; });
  return NextResponse.json({ acceptance }, { status: 201 });
}
export const POST = apiRoute("task:accept", accept, { highRisk: true, idempotent: true });
