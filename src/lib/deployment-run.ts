import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dispatchDeployment } from "@/lib/github-app";
import { DEPLOYMENT_STEPS, deploymentHealthStatus } from "@/lib/deployment";

export const deploymentInclude = {
  version: { select: { id: true, name: true, status: true } },
  environment: true,
  initiatedBy: { select: { id: true, name: true } },
  rollbackOf: { select: { id: true, status: true } },
  steps: { orderBy: { sortOrder: "asc" as const } },
  approvals: {
    include: {
      requestedBy: { select: { id: true, name: true } },
      decidedBy: { select: { id: true, name: true } },
    },
    orderBy: { requestedAt: "desc" as const },
  },
  artifacts: { include: { service: { select: { id: true, name: true, slug: true } } } },
  release: true,
} satisfies Prisma.DeploymentRunInclude;

export async function dispatchDeploymentRun(runId: string) {
  const run = await prisma.deploymentRun.findUnique({
    where: { id: runId },
    include: {
      environment: true,
      version: {
        include: {
          components: {
            include: { service: { include: { repository: true } } },
          },
        },
      },
    },
  });
  if (!run) throw new Error("发布任务不存在");
  if (run.status !== "QUEUED") throw new Error("发布任务当前不可执行");
  if (run.migrationRisk === "BREAKING") throw new Error("检测到破坏性数据库迁移，需要先完成向前兼容迁移");
  const components = run.version.components.filter((item) => item.service.enabled);
  if (!components.length) throw new Error("版本尚未锁定可部署服务与 commit");

  await prisma.deploymentRun.update({
    where: { id: run.id },
    data: {
      status: "DISPATCHED",
      startedAt: run.startedAt || new Date(),
      steps: {
        createMany: {
          data: DEPLOYMENT_STEPS.map(([key, name], sortOrder) => ({ key, name, sortOrder })),
          skipDuplicates: true,
        },
      },
    },
  });

  try {
    const previousArtifacts = run.environment.currentDeploymentRunId
      ? await prisma.buildArtifact.findMany({ where: { deploymentRunId: run.environment.currentDeploymentRunId } })
      : [];
    await Promise.all(
      components.map(async (component) => {
        const repository = component.service.repository;
        const imageName = `ghcr.io/${repository.fullName.toLowerCase()}`;
        await prisma.buildArtifact.upsert({
          where: {
            deploymentRunId_serviceId: {
              deploymentRunId: run.id,
              serviceId: component.serviceId,
            },
          },
          create: {
            projectId: run.projectId,
            versionComponentId: component.id,
            serviceId: component.serviceId,
            deploymentRunId: run.id,
            commitSha: component.commitSha.toLowerCase(),
            imageRef: `${imageName}:${component.commitSha.toLowerCase()}`,
          },
          update: { deploymentRunId: run.id, status: "BUILDING", testsPassed: null },
        });
        await dispatchDeployment({
          installationId: repository.installationId,
          owner: repository.owner,
          repository: repository.name,
          workflowPath: repository.workflowPath,
          ref: repository.defaultBranch,
          deploymentRunId: run.id,
          environment: run.environment.githubEnvironment,
          commitSha: component.commitSha,
          imageName,
          serviceId: component.serviceId,
          serviceSlug: component.service.slug,
          dockerfilePath: component.service.dockerfilePath,
          buildContext: component.service.buildContext,
          previousCommitSha: previousArtifacts.find((item) => item.serviceId === component.serviceId)?.commitSha,
        });
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法触发 GitHub Actions";
    await prisma.deploymentRun.update({
      where: { id: run.id },
      data: { status: "FAILED", failureReason: message, finishedAt: new Date(), lockKey: null },
    });
    throw error;
  }
}

export async function dispatchRollbackRun(runId: string) {
  const run = await prisma.deploymentRun.findUnique({
    where: { id: runId },
    include: {
      environment: true,
      rollbackOf: {
        include: {
          artifacts: {
            where: { status: "READY", imageDigest: { not: null } },
            include: {
              versionComponent: true,
              service: { include: { repository: true } },
            },
          },
        },
      },
    },
  });
  if (!run?.rollbackOf) throw new Error("回滚目标不存在");
  if (run.status !== "QUEUED") throw new Error("回滚任务当前不可执行");
  if (!run.rollbackOf.artifacts.length) throw new Error("目标发布没有可复用的镜像制品");
  await prisma.deploymentRun.update({
    where: { id: run.id },
    data: {
      status: "DISPATCHED",
      startedAt: new Date(),
      steps: {
        createMany: {
          data: DEPLOYMENT_STEPS.map(([key, name], sortOrder) => ({
            key,
            name,
            sortOrder,
            status: ["checkout", "test", "build", "migration"].includes(key) ? "SKIPPED" : "PENDING",
          })),
          skipDuplicates: true,
        },
      },
    },
  });
  try {
    await Promise.all(
      run.rollbackOf.artifacts.map((artifact) => {
        const repository = artifact.service.repository;
        return dispatchDeployment({
          installationId: repository.installationId,
          owner: repository.owner,
          repository: repository.name,
          workflowPath: repository.workflowPath,
          ref: repository.defaultBranch,
          deploymentRunId: run.id,
          environment: run.environment.githubEnvironment,
          commitSha: artifact.commitSha,
          imageName: artifact.imageRef.split(":")[0],
          serviceId: artifact.serviceId,
          serviceSlug: artifact.service.slug,
          dockerfilePath: artifact.service.dockerfilePath,
          buildContext: artifact.service.buildContext,
          mode: "rollback",
          imageRef: `${artifact.imageRef.split("@")[0]}@${artifact.imageDigest}`,
        });
      }),
    );
  } catch (error) {
    await failDeployment(run.id, error instanceof Error ? error.message : "无法触发回滚流水线");
    throw error;
  }
}

export async function checkDeploymentEnvironment(environmentId: string, deploymentRunId?: string) {
  const environment = await prisma.deploymentEnvironment.findUnique({ where: { id: environmentId } });
  if (!environment) throw new Error("部署环境不存在");
  const started = Date.now();
  let ok = false;
  let statusCode: number | null = null;
  let error: string | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(new URL(environment.healthPath, environment.url), {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    statusCode = response.status;
    ok = response.ok;
    if (!ok) error = `HTTP ${response.status}`;
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "健康检查失败";
  }
  const next = deploymentHealthStatus(environment.consecutiveFailures, ok);
  const latencyMs = Date.now() - started;
  const [health] = await prisma.$transaction([
    prisma.environmentHealthCheck.create({
      data: {
        environmentId,
        deploymentRunId,
        status: next.status,
        statusCode,
        latencyMs,
        error,
      },
    }),
    prisma.deploymentEnvironment.update({
      where: { id: environmentId },
      data: {
        healthStatus: next.status,
        consecutiveFailures: next.consecutiveFailures,
        lastCheckedAt: new Date(),
      },
    }),
  ]);
  return health;
}

export async function failDeployment(runId: string, reason: string, status: "FAILED" | "ROLLED_BACK" = "FAILED") {
  return prisma.deploymentRun.update({
    where: { id: runId },
    data: { status, failureReason: reason, finishedAt: new Date(), lockKey: null },
  });
}
