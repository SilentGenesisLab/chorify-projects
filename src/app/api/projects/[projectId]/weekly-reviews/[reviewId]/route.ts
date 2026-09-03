import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUserId } from "@/lib/team-permissions";
import { getProjectAccess } from "@/lib/project-permissions";

const schema = z.object({
  summary: z.string().trim().max(20_000),
  nextFocus: z.string().trim().max(20_000),
  conclusion: z.string().trim().max(5_000),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ projectId: string; reviewId: string }> }) {
  const userId = await getRequestUserId(request);
  const { projectId, reviewId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const access = await getProjectAccess(projectId, userId);
  if (!access?.canManage) return NextResponse.json({ error: "只有项目管理者可以编辑周总结" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "周总结内容过长或格式无效" }, { status: 400 });
  const existing = await prisma.projectWeeklyReview.findFirst({ where: { id: reviewId, projectId } });
  if (!existing) return NextResponse.json({ error: "周记录不存在" }, { status: 404 });
  const review = await prisma.$transaction(async (tx) => {
    const updated = await tx.projectWeeklyReview.update({ where: { id: reviewId }, data: { ...parsed.data, lastEditorId: userId } });
    await tx.auditLog.create({ data: { userId, projectId, actorType: "USER", action: "UPDATE_PROJECT_WEEKLY_REVIEW", resource: "PROJECT_WEEKLY_REVIEW", resourceId: reviewId, channel: "WEB", metadata: { projectId, weekStart: existing.weekStart.toISOString(), fields: Object.keys(parsed.data) } } });
    return updated;
  });
  return NextResponse.json({ review });
}
