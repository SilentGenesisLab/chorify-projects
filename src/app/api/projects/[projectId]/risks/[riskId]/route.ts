import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUserId } from "@/lib/team-permissions";
import { getProjectAccess } from "@/lib/project-permissions";

const schema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(5_000).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  status: z.enum(["OPEN", "MITIGATING", "RESOLVED", "ACCEPTED"]).optional(),
  ownerId: z.string().cuid().nullable().optional(),
  mitigation: z.string().trim().max(5_000).optional(),
  dueAt: z.string().datetime().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "没有可更新的字段");

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ projectId: string; riskId: string }> }) {
  const userId = await getRequestUserId(request);
  const { projectId, riskId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const access = await getProjectAccess(projectId, userId);
  if (!access?.canManage) return NextResponse.json({ error: "只有项目管理者可以更新风险" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "风险内容无效" }, { status: 400 });
  const existing = await prisma.projectRisk.findFirst({ where: { id: riskId, projectId } });
  if (!existing) return NextResponse.json({ error: "风险不存在" }, { status: 404 });
  if (parsed.data.ownerId && parsed.data.ownerId !== userId && !(await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: parsed.data.ownerId } } }))) return NextResponse.json({ error: "风险负责人必须是项目成员" }, { status: 400 });
  const terminal = parsed.data.status ? ["RESOLVED", "ACCEPTED"].includes(parsed.data.status) : ["RESOLVED", "ACCEPTED"].includes(existing.status);
  const risk = await prisma.$transaction(async (tx) => {
    const updated = await tx.projectRisk.update({ where: { id: riskId }, data: { ...parsed.data, resolvedAt: terminal ? existing.resolvedAt || new Date() : null } });
    await tx.auditLog.create({ data: { userId, projectId, actorType: "USER", action: "UPDATE_PROJECT_RISK", resource: "PROJECT_RISK", resourceId: riskId, channel: "WEB", metadata: { projectId, fields: Object.keys(parsed.data), fromStatus: existing.status, toStatus: parsed.data.status } } });
    return updated;
  });
  return NextResponse.json({ risk });
}
