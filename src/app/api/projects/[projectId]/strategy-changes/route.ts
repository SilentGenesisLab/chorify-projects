import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUserId } from "@/lib/team-permissions";
import { getProjectAccess } from "@/lib/project-permissions";

const schema = z.object({
  title: z.string().trim().min(2).max(160),
  before: z.string().trim().min(2).max(10_000),
  after: z.string().trim().min(2).max(10_000),
  reason: z.string().trim().min(2).max(10_000),
  impact: z.string().trim().max(5_000).default(""),
  details: z.string().trim().max(20_000).default(""),
  deciderId: z.string().cuid(),
  effectiveAt: z.string().datetime(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const userId = await getRequestUserId(request);
  const { projectId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const access = await getProjectAccess(projectId, userId);
  if (!access?.canManage) return NextResponse.json({ error: "只有项目管理者可以记录策略调整" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "策略调整内容无效" }, { status: 400 });
  if (parsed.data.deciderId !== userId && !(await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: parsed.data.deciderId } } }))) return NextResponse.json({ error: "决策人必须是项目成员" }, { status: 400 });
  const strategy = await prisma.$transaction(async (tx) => {
    const created = await tx.projectStrategyChange.create({ data: { ...parsed.data, effectiveAt: new Date(parsed.data.effectiveAt), projectId, createdById: userId } });
    await tx.auditLog.create({ data: { userId, projectId, actorType: "USER", action: "CREATE_PROJECT_STRATEGY_CHANGE", resource: "PROJECT_STRATEGY_CHANGE", resourceId: created.id, channel: "WEB", metadata: { projectId, effectiveAt: created.effectiveAt.toISOString() } } });
    return created;
  });
  return NextResponse.json({ strategy }, { status: 201 });
}
