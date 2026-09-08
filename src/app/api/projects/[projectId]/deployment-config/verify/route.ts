import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { githubFileExists, resolveCommit } from "@/lib/github-app";
import { checkDeploymentEnvironment } from "@/lib/deployment-run";
import { getProjectAccess } from "@/lib/project-permissions";
import { getRequestUserId } from "@/lib/team-permissions";

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const userId = await getRequestUserId(request);
  const { projectId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!(await getProjectAccess(projectId, userId))?.canManage) return NextResponse.json({ error: "只有项目管理员可以验证 CI/CD 配置" }, { status: 403 });
  const [repositories, services, environments] = await Promise.all([
    prisma.projectRepository.findMany({ where: { projectId, status: "ACTIVE" } }),
    prisma.deployableService.findMany({ where: { projectId, enabled: true }, include: { repository: true } }),
    prisma.deploymentEnvironment.findMany({ where: { projectId, enabled: true } }),
  ]);
  const results: Array<{ id: string; status: "READY" | "ERROR"; detail: string }> = [];
  for (const repository of repositories) {
    try {
      const commit = await resolveCommit(repository.owner, repository.name, repository.installationId, repository.defaultBranch);
      const workflow = await githubFileExists(repository.owner, repository.name, repository.installationId, `.github/workflows/${repository.workflowPath}`, repository.defaultBranch);
      await prisma.projectRepository.update({ where: { id: repository.id }, data: { status: workflow ? "ACTIVE" : "ERROR", lastSyncedAt: new Date(), lastError: workflow ? null : "未找到 Actions 工作流" } });
      results.push({ id: repository.id, status: workflow ? "READY" : "ERROR", detail: workflow ? `仓库可访问，${commit.sha.slice(0, 8)}` : "未找到 Actions 工作流" });
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message.slice(0, 300) : "GitHub 连接失败";
      await prisma.projectRepository.update({ where: { id: repository.id }, data: { status: "ERROR", lastError: detail } });
      results.push({ id: repository.id, status: "ERROR", detail });
    }
  }
  for (const service of services) {
    const found = await githubFileExists(service.repository.owner, service.repository.name, service.repository.installationId, service.dockerfilePath, service.repository.defaultBranch).catch(() => false);
    results.push({ id: service.id, status: found ? "READY" : "ERROR", detail: found ? `已找到 ${service.dockerfilePath}` : `未找到 ${service.dockerfilePath}` });
  }
  for (const environment of environments) {
    const health = await checkDeploymentEnvironment(environment.id, environment.currentDeploymentRunId || undefined);
    results.push({ id: environment.id, status: health.status === "HEALTHY" ? "READY" : "ERROR", detail: health.status === "HEALTHY" ? `健康检查通过，${health.latencyMs}ms` : health.error || "健康检查失败" });
  }
  await prisma.auditLog.create({ data: { userId, projectId, actorType: "USER", action: "VERIFY_DEPLOYMENT_CONFIG", resource: "PROJECT", resourceId: projectId, channel: "WEB", metadata: { result: results.every((item) => item.status === "READY") ? "SUCCESS" : "PARTIAL" } } });
  return NextResponse.json({ results });
}
