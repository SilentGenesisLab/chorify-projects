import { NextResponse, type NextRequest } from "next/server";
import { getRequestUserId } from "@/lib/team-permissions";
import { acceptTask, taskAcceptanceSchema } from "@/lib/task-workflow";

export async function POST(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const parsed = taskAcceptanceSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: "验收结论和验证证据至少需要 3 个字符", details: parsed.error.flatten() }, { status: 400 });
  const { taskId } = await params;
  const result = await acceptTask(taskId, userId, parsed.data);
  return result.ok
    ? NextResponse.json({ acceptance: result.value }, { status: 201 })
    : NextResponse.json({ error: result.error }, { status: result.status });
}
