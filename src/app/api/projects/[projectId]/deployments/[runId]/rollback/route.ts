import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { deploymentInclude, dispatchRollbackRun } from "@/lib/deployment-run";
import { getProjectAccess } from "@/lib/project-permissions";
import { getRequestUserId } from "@/lib/team-permissions";

const schema = z.object({ environmentId: z.string().min(1).optional() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string; runId: string }> }) {
  const userId = await getRequestUserId(request);
  const { projectId, runId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!(await getProjectAccess(projectId, userId))?.canManage) return NextResponse.json({ error: "只有项目管理员可以回滚" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "回滚参数错误" }, { status: 400 });
  const target = await prisma.deploymentRun.findFirst({
    where: { id: runId, projectId, status: "SUCCEEDED" },
    include: { artifacts: { where: { status: "READY", imageDigest: { not: null } } } },
  });
  if (!target?.artifacts.length) return NextResponse.json({ error: "目标发布没有可回滚镜像" }, { status: 409 });
  const environment = await prisma.deploymentEnvironment.findFirst({ where: { id: parsed.data.environmentId || target.environmentId, projectId, enabled: true } });
  if (!environment) return NextResponse.json({ error: "部署环境不存在" }, { status: 404 });
  const manifestHash = createHash("sha256").update(`rollback:${target.id}:${environment.id}:${target.manifestHash}`).digest("hex");
  const requiresApproval = environment.kind === "PRODUCTION";
  let run;
  try {
    run = await prisma.$transaction(async (tx) => {
      const created = await tx.deploymentRun.create({
        data: { projectId, versionId: target.versionId, environmentId: environment.id, initiatedById: userId, rollbackOfId: target.id, type: "ROLLBACK", status: requiresApproval ? "WAITING_APPROVAL" : "QUEUED", lockKey: environment.id, manifestHash, requiresApproval },
      });
      if (requiresApproval)
        await tx.deploymentApproval.create({ data: { deploymentRunId: created.id, requestedById: userId, manifestHash, expiresAt: new Date(Date.now() + 30 * 60_000) } });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "该环境已有发布任务正在执行" }, { status: 409 });
    throw error;
  }
  await prisma.auditLog.create({ data: { userId, projectId, actorType: "USER", action: "CREATE_ROLLBACK", resource: "DEPLOYMENT", resourceId: run.id, channel: "WEB", metadata: { targetRunId: target.id, environmentId: environment.id, result: "SUCCESS" } } });
  if (!requiresApproval) await dispatchRollbackRun(run.id).catch(() => undefined);
  return NextResponse.json({ run: await prisma.deploymentRun.findUnique({ where: { id: run.id }, include: deploymentInclude }) }, { status: 201 });
}
