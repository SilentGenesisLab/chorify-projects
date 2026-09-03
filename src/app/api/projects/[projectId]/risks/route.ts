import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUserId } from "@/lib/team-permissions";
import { getProjectAccess } from "@/lib/project-permissions";

const schema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5_000).default(""),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  status: z.enum(["OPEN", "MITIGATING", "RESOLVED", "ACCEPTED"]).default("OPEN"),
  ownerId: z.string().cuid().nullable().optional(),
  mitigation: z.string().trim().max(5_000).default(""),
  dueAt: z.string().datetime().nullable().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const userId = await getRequestUserId(request);
  const { projectId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const access = await getProjectAccess(projectId, userId);
  if (!access?.canManage) return NextResponse.json({ error: "只有项目管理者可以登记风险" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "风险内容无效" }, { status: 400 });
  const ownerId = parsed.data.ownerId || null;
  if (ownerId && ownerId !== userId && !(await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: ownerId } } }))) return NextResponse.json({ error: "风险负责人必须是项目成员" }, { status: 400 });
  const now = new Date();
  const risk = await prisma.$transaction(async (tx) => {
    const created = await tx.projectRisk.create({ data: { ...parsed.data, ownerId, projectId, createdById: userId, resolvedAt: ["RESOLVED", "ACCEPTED"].includes(parsed.data.status) ? now : null } });
    await tx.auditLog.create({ data: { userId, projectId, actorType: "USER", action: "CREATE_PROJECT_RISK", resource: "PROJECT_RISK", resourceId: created.id, channel: "WEB", metadata: { projectId, severity: created.severity, status: created.status } } });
    return created;
  });
  return NextResponse.json({ risk }, { status: 201 });
}
