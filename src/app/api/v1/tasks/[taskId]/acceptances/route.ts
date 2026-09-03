import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api-route";
import { authenticatedUserId } from "@/lib/web-auth";
import { acceptTask, taskAcceptanceSchema } from "@/lib/task-workflow";

async function accept(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const userId = await authenticatedUserId(request); const { taskId } = await params; const parsed = taskAcceptanceSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "验收结论和验证证据不能为空", details: parsed.error.flatten() }, { status: 400 });
  if (!userId) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  const result = await acceptTask(taskId, userId, parsed.data);
  return result.ok
    ? NextResponse.json({ acceptance: result.value }, { status: 201 })
    : NextResponse.json({ error: result.error }, { status: result.status });
}
export const POST = apiRoute("task:accept", accept, { highRisk: true, idempotent: true });
