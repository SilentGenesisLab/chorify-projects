import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { shouldApplyDeploymentStepEvent } from "@/lib/deployment";

const schema = z.object({
  status: z.enum(["BUILDING", "DEPLOYING", "VERIFYING", "SUCCEEDED", "FAILED", "ROLLED_BACK"]),
  step: z.enum(["checkout", "test", "build", "migration", "deploy", "health", "switch", "observe"]).optional(),
  stepStatus: z.enum(["RUNNING", "SUCCEEDED", "FAILED", "SKIPPED"]).optional(),
  serviceId: z.string().min(1).optional(),
  githubRunId: z.string().max(40).optional(),
  githubRunUrl: z.string().url().optional(),
  imageRef: z.string().max(500).optional(),
  imageDigest: z.string().max(200).optional(),
  activeSlot: z.enum(["blue", "green"]).optional(),
  previousSlot: z.enum(["blue", "green"]).optional(),
  latencyMs: z.number().int().min(0).optional(),
  error: z.string().max(5000).optional(),
  output: z.record(z.string(), z.unknown()).optional(),
});

function allowed(request: NextRequest) {
  const expected = process.env.DEPLOY_CALLBACK_SECRET || "";
  const actual = request.headers.get("x-chorify-deploy-secret") || "";
  if (!expected || !actual) return false;
  const a = Buffer.from(createHash("sha256").update(actual).digest("hex"));
  const b = Buffer.from(createHash("sha256").update(expected).digest("hex"));
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  if (!allowed(request)) return NextResponse.json({ error: "无效的流水线回调凭据" }, { status: 401 });
  const { runId } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "回调参数错误" }, { status: 400 });
  const input = parsed.data;
  const run = await prisma.deploymentRun.findUnique({
    where: { id: runId },
    include: {
      environment: true,
      version: { include: { components: { where: { service: { enabled: true } } } } },
      artifacts: true,
      rollbackOf: { include: { artifacts: { include: { service: true } } } },
    },
  });
  if (!run) return NextResponse.json({ error: "发布任务不存在" }, { status: 404 });
  if (["FAILED", "ROLLED_BACK", "CANCELLED"].includes(run.status) && input.status !== run.status)
    return NextResponse.json({ ok: true, ignored: true });

  if (input.step && shouldApplyDeploymentStepEvent(run.type, input.step)) {
    await prisma.deploymentStep.updateMany({
      where: { deploymentRunId: run.id, key: input.step },
      data: {
        status: input.stepStatus || (input.status === "FAILED" ? "FAILED" : "RUNNING"),
        logsUrl: input.githubRunUrl,
        output: input.output as Prisma.InputJsonValue | undefined,
        startedAt: input.stepStatus === "RUNNING" ? new Date() : undefined,
        finishedAt: input.stepStatus && input.stepStatus !== "RUNNING" ? new Date() : undefined,
      },
    });
  }
  if (input.serviceId && (input.imageRef || input.imageDigest || ["SUCCEEDED", "FAILED", "ROLLED_BACK"].includes(input.status))) {
    await prisma.buildArtifact.updateMany({
      where: { deploymentRunId: run.id, serviceId: input.serviceId },
      data: {
        imageRef: input.imageRef,
        imageDigest: input.imageDigest,
        status: input.status === "SUCCEEDED" ? "READY" : input.status === "FAILED" || input.status === "ROLLED_BACK" ? "FAILED" : "BUILDING",
        testsPassed: input.status === "SUCCEEDED" ? true : undefined,
        builtAt: input.status === "SUCCEEDED" ? new Date() : undefined,
        manifest: input.output as Prisma.InputJsonValue | undefined,
      },
    });
  }
  if (input.status === "FAILED" || input.status === "ROLLED_BACK") {
    const finalStatus = input.status;
    await prisma.$transaction([
      prisma.deploymentRun.update({ where: { id: run.id }, data: { status: finalStatus, failureReason: input.error || (finalStatus === "ROLLED_BACK" ? "健康检查失败，已自动回滚" : "流水线执行失败"), githubRunId: input.githubRunId, githubRunUrl: input.githubRunUrl, activeSlot: input.activeSlot, previousSlot: input.previousSlot, finishedAt: new Date(), lockKey: null } }),
      prisma.release.upsert({ where: { deploymentRunId: run.id }, create: { projectId: run.projectId, versionId: run.versionId, deploymentRunId: run.id, build: input.githubRunId || run.id, environment: run.environment.name, notes: input.error || "发布失败", rollbackPlan: "使用上一健康镜像 digest 回切", status: finalStatus, releasedAt: new Date(), isLegacy: false }, update: { status: finalStatus, notes: input.error || "发布失败", releasedAt: new Date() } }),
      prisma.auditLog.create({ data: { projectId: run.projectId, actorType: "SYSTEM", action: finalStatus === "ROLLED_BACK" ? "AUTO_ROLLBACK_DEPLOYMENT" : "FAIL_DEPLOYMENT", resource: "DEPLOYMENT", resourceId: run.id, channel: "SYSTEM", metadata: { error: input.error, githubRunId: input.githubRunId, result: finalStatus } } }),
    ]);
    return NextResponse.json({ ok: true, status: finalStatus });
  }
  if (input.status !== "SUCCEEDED") {
    await prisma.deploymentRun.update({ where: { id: run.id }, data: { status: input.status, githubRunId: input.githubRunId, githubRunUrl: input.githubRunUrl, startedAt: run.startedAt || new Date() } });
    return NextResponse.json({ ok: true, status: input.status });
  }

  const ready = run.type === "ROLLBACK" ? run.rollbackOf?.artifacts.length || 0 : await prisma.buildArtifact.count({ where: { deploymentRunId: run.id, status: "READY" } });
  if (ready < run.version.components.length) return NextResponse.json({ ok: true, waitingForServices: run.version.components.length - ready });
  const artifacts = run.type === "ROLLBACK"
    ? run.rollbackOf?.artifacts || []
    : await prisma.buildArtifact.findMany({ where: { deploymentRunId: run.id }, include: { service: true } });
  const commitSummary = Object.fromEntries(artifacts.map((item) => [item.service.slug, item.commitSha]));
  const imageSummary = Object.fromEntries(artifacts.map((item) => [item.service.slug, { ref: item.imageRef, digest: item.imageDigest }]));
  await prisma.$transaction([
    prisma.deploymentRun.update({ where: { id: run.id }, data: { status: "SUCCEEDED", githubRunId: input.githubRunId, githubRunUrl: input.githubRunUrl, activeSlot: input.activeSlot, previousSlot: input.previousSlot, finishedAt: new Date(), lockKey: null } }),
    prisma.deploymentEnvironment.update({ where: { id: run.environmentId }, data: { currentDeploymentRunId: run.id, activeSlot: input.activeSlot, healthStatus: "HEALTHY", consecutiveFailures: 0, lastCheckedAt: new Date() } }),
    prisma.version.update({ where: { id: run.versionId }, data: { status: "RELEASED" } }),
    prisma.release.upsert({ where: { deploymentRunId: run.id }, create: { projectId: run.projectId, versionId: run.versionId, deploymentRunId: run.id, build: input.githubRunId || run.id, environment: run.environment.name, notes: "CI/CD 蓝绿发布成功", rollbackPlan: "选择历史成功发布，按镜像 digest 回切", status: "SUCCEEDED", releasedAt: new Date(), isLegacy: false, commitSummary, imageSummary }, update: { status: "SUCCEEDED", releasedAt: new Date(), commitSummary, imageSummary } }),
    prisma.auditLog.create({ data: { projectId: run.projectId, actorType: "SYSTEM", action: "SUCCEED_DEPLOYMENT", resource: "DEPLOYMENT", resourceId: run.id, channel: "SYSTEM", metadata: { githubRunId: input.githubRunId, activeSlot: input.activeSlot, result: "SUCCESS" } } }),
  ]);
  if (input.latencyMs !== undefined)
    await prisma.environmentHealthCheck.create({ data: { environmentId: run.environmentId, deploymentRunId: run.id, status: "HEALTHY", statusCode: 200, latencyMs: input.latencyMs } });
  return NextResponse.json({ ok: true, status: "SUCCEEDED" });
}
