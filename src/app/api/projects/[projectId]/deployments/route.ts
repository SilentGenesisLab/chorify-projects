import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getProjectAccess } from "@/lib/project-permissions";
import { getRequestUserId } from "@/lib/team-permissions";
import { deploymentManifestHash } from "@/lib/deployment";
import { deploymentInclude, dispatchDeploymentRun } from "@/lib/deployment-run";

const schema = z.object({
  versionId: z.string().min(1),
  environmentId: z.string().min(1),
  migrationRisk: z.enum(["NONE", "BACKWARD_COMPATIBLE", "BREAKING"]).default("NONE"),
  components: z.array(z.object({
    serviceId: z.string().min(1),
    commitSha: z.string().trim().regex(/^[a-f0-9]{40}$/i, "请输入完整的40位 commit SHA"),
    branch: z.string().trim().max(100).nullable().optional(),
  })).min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const userId = await getRequestUserId(request);
  const { projectId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const access = await getProjectAccess(projectId, userId);
  if (!access?.canManage) return NextResponse.json({ error: "只有项目管理员可以发起发布" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "发布参数不完整" }, { status: 400 });
  if (parsed.data.migrationRisk === "BREAKING")
    return NextResponse.json({ error: "破坏性数据库迁移不能直接发布，请先拆分为向前兼容迁移" }, { status: 409 });
  const [version, environment, services] = await Promise.all([
    prisma.version.findFirst({ where: { id: parsed.data.versionId, projectId } }),
    prisma.deploymentEnvironment.findFirst({ where: { id: parsed.data.environmentId, projectId, enabled: true } }),
    prisma.deployableService.findMany({ where: { projectId, id: { in: parsed.data.components.map((item) => item.serviceId) }, enabled: true }, include: { repository: true } }),
  ]);
  if (!version || !environment) return NextResponse.json({ error: "版本或部署环境不存在" }, { status: 404 });
  if (services.length !== new Set(parsed.data.components.map((item) => item.serviceId)).size)
    return NextResponse.json({ error: "包含无效或未启用的部署服务" }, { status: 400 });

  const components = parsed.data.components.map((component) => {
    const service = services.find((item) => item.id === component.serviceId)!;
    return { serviceId: service.id, service: service.name, repository: service.repository.fullName, commitSha: component.commitSha, branch: component.branch };
  });
  const manifestHash = deploymentManifestHash({ projectId, versionId: version.id, environmentId: environment.id, components });
  const requiresApproval = environment.kind === "PRODUCTION";
  let run;
  try {
    run = await prisma.$transaction(async (tx) => {
      for (const component of parsed.data.components) {
        await tx.versionComponent.upsert({
          where: { versionId_serviceId: { versionId: version.id, serviceId: component.serviceId } },
          create: { versionId: version.id, ...component },
          update: { commitSha: component.commitSha.toLowerCase(), branch: component.branch },
        });
      }
      const created = await tx.deploymentRun.create({
        data: {
          projectId,
          versionId: version.id,
          environmentId: environment.id,
          initiatedById: userId,
          manifestHash,
          migrationRisk: parsed.data.migrationRisk,
          requiresApproval,
          status: requiresApproval ? "WAITING_APPROVAL" : "QUEUED",
          lockKey: environment.id,
        },
      });
      if (requiresApproval)
        await tx.deploymentApproval.create({
          data: { deploymentRunId: created.id, requestedById: userId, manifestHash, expiresAt: new Date(Date.now() + 30 * 60_000) },
        });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return NextResponse.json({ error: "该环境已有发布任务正在执行，请等待完成" }, { status: 409 });
    throw error;
  }
  await prisma.auditLog.create({
    data: { userId, projectId, actorType: "USER", action: "CREATE_DEPLOYMENT", resource: "DEPLOYMENT", resourceId: run.id, channel: "WEB", metadata: { environmentId: environment.id, versionId: version.id, manifestHash, result: "SUCCESS" } },
  });
  if (!requiresApproval) await dispatchDeploymentRun(run.id).catch(() => undefined);
  return NextResponse.json({ run: await prisma.deploymentRun.findUnique({ where: { id: run.id }, include: deploymentInclude }) }, { status: 201 });
}
