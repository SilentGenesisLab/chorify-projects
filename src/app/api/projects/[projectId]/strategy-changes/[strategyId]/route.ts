import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUserId } from "@/lib/team-permissions";
import { getProjectAccess } from "@/lib/project-permissions";

const schema = z.object({
  title: z.string().trim().min(2).max(160).optional(), before: z.string().trim().min(2).max(10_000).optional(), after: z.string().trim().min(2).max(10_000).optional(), reason: z.string().trim().min(2).max(10_000).optional(), impact: z.string().trim().max(5_000).optional(), details: z.string().trim().max(20_000).optional(), deciderId: z.string().cuid().optional(), effectiveAt: z.string().datetime().optional(), status: z.enum(["ACTIVE", "VOID"]).optional(),
}).refine((value) => Object.keys(value).length > 0, "没有可更新的字段");

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ projectId: string; strategyId: string }> }) {
  const userId = await getRequestUserId(request); const { projectId, strategyId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!(await getProjectAccess(projectId, userId))?.canManage) return NextResponse.json({ error: "只有项目管理者可以更新策略调整" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "策略调整内容无效" }, { status: 400 });
  const existing = await prisma.projectStrategyChange.findFirst({ where: { id: strategyId, projectId } });
  if (!existing) return NextResponse.json({ error: "策略调整不存在" }, { status: 404 });
  if (parsed.data.deciderId && parsed.data.deciderId !== userId && !(await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: parsed.data.deciderId } } }))) return NextResponse.json({ error: "决策人必须是项目成员" }, { status: 400 });
  const strategy = await prisma.$transaction(async (tx) => {
    const updated = await tx.projectStrategyChange.update({ where: { id: strategyId }, data: { ...parsed.data, effectiveAt: parsed.data.effectiveAt ? new Date(parsed.data.effectiveAt) : undefined, voidedAt: parsed.data.status === "VOID" ? existing.voidedAt || new Date() : parsed.data.status === "ACTIVE" ? null : undefined } });
    await tx.auditLog.create({ data: { userId, projectId, actorType: "USER", action: parsed.data.status === "VOID" ? "VOID_PROJECT_STRATEGY_CHANGE" : "UPDATE_PROJECT_STRATEGY_CHANGE", resource: "PROJECT_STRATEGY_CHANGE", resourceId: strategyId, channel: "WEB", metadata: { projectId, fields: Object.keys(parsed.data) } } });
    return updated;
  });
  return NextResponse.json({ strategy });
}
