import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canApproveDeployment } from "@/lib/deployment";
import { deploymentInclude, dispatchDeploymentRun, dispatchRollbackRun } from "@/lib/deployment-run";
import { getProjectAccess } from "@/lib/project-permissions";
import { getRequestUserId } from "@/lib/team-permissions";

const schema = z.object({ comment: z.string().trim().max(1000).default("") });

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string; runId: string }> }) {
  const userId = await getRequestUserId(request);
  const { projectId, runId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!(await getProjectAccess(projectId, userId))?.canManage) return NextResponse.json({ error: "只有项目管理员可以审批" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "审批意见格式错误" }, { status: 400 });
  const run = await prisma.deploymentRun.findFirst({ where: { id: runId, projectId }, include: { approvals: { where: { status: "PENDING" }, orderBy: { requestedAt: "desc" }, take: 1 } } });
  const approval = run?.approvals[0];
  if (!run || run.status !== "WAITING_APPROVAL" || !approval) return NextResponse.json({ error: "没有待处理的审批" }, { status: 409 });
  const error = canApproveDeployment({ requesterId: run.initiatedById, approverId: userId, manifestHash: run.manifestHash, approvalManifestHash: approval.manifestHash, expiresAt: approval.expiresAt });
  if (error) return NextResponse.json({ error }, { status: 409 });
  await prisma.$transaction([
    prisma.deploymentApproval.update({ where: { id: approval.id }, data: { status: "APPROVED", decidedById: userId, decidedAt: new Date(), comment: parsed.data.comment } }),
    prisma.deploymentRun.update({ where: { id: run.id }, data: { status: "QUEUED" } }),
    prisma.auditLog.create({ data: { userId, projectId, actorType: "USER", action: "APPROVE_DEPLOYMENT", resource: "DEPLOYMENT", resourceId: run.id, channel: "WEB", metadata: { manifestHash: run.manifestHash, result: "SUCCESS" } } }),
  ]);
  if (run.type === "ROLLBACK") await dispatchRollbackRun(run.id).catch(() => undefined);
  else await dispatchDeploymentRun(run.id).catch(() => undefined);
  return NextResponse.json({ run: await prisma.deploymentRun.findUnique({ where: { id: run.id }, include: deploymentInclude }) });
}
