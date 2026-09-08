import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deploymentInclude, dispatchDeploymentRun } from "@/lib/deployment-run";
import { getProjectAccess } from "@/lib/project-permissions";
import { getRequestUserId } from "@/lib/team-permissions";

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string; runId: string }> }) {
  const userId = await getRequestUserId(request);
  const { projectId, runId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!(await getProjectAccess(projectId, userId))?.canManage) return NextResponse.json({ error: "只有项目管理员可以重新执行发布" }, { status: 403 });
  const target = await prisma.deploymentRun.findFirst({ where: { id: runId, projectId, status: { in: ["FAILED", "CANCELLED", "ROLLED_BACK"] }, type: "DEPLOY" }, include: { environment: true, artifacts: { include: { versionComponent: true } } } });
  if (!target?.artifacts.length) return NextResponse.json({ error: "原发布任务没有可重试的服务和 commit" }, { status: 409 });
  const requiresApproval = target.environment.kind === "PRODUCTION";
  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      for (const artifact of target.artifacts) await tx.versionComponent.update({ where: { id: artifact.versionComponentId }, data: { commitSha: artifact.commitSha } });
      const run = await tx.deploymentRun.create({ data: { projectId, versionId: target.versionId, environmentId: target.environmentId, initiatedById: userId, type: "DEPLOY", status: requiresApproval ? "WAITING_APPROVAL" : "QUEUED", lockKey: target.environmentId, manifestHash: target.manifestHash, migrationRisk: target.migrationRisk, requiresApproval } });
      if (requiresApproval) await tx.deploymentApproval.create({ data: { deploymentRunId: run.id, requestedById: userId, manifestHash: run.manifestHash, expiresAt: new Date(Date.now() + 30 * 60_000) } });
      return run;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (cause) {
    if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002") return NextResponse.json({ error: "该环境已有发布任务正在执行" }, { status: 409 });
    throw cause;
  }
  await prisma.auditLog.create({ data: { userId, projectId, actorType: "USER", action: "RETRY_DEPLOYMENT", resource: "DEPLOYMENT", resourceId: created.id, channel: "WEB", metadata: { originalRunId: target.id, result: "SUCCESS" } } });
  if (!requiresApproval) await dispatchDeploymentRun(created.id).catch(() => undefined);
  return NextResponse.json({ run: await prisma.deploymentRun.findUnique({ where: { id: created.id }, include: deploymentInclude }) }, { status: 201 });
}
