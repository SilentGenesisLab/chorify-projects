import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkDeploymentEnvironment } from "@/lib/deployment-run";
import { getProjectAccess } from "@/lib/project-permissions";
import { getRequestUserId } from "@/lib/team-permissions";

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string; environmentId: string }> }) {
  const userId = await getRequestUserId(request);
  const { projectId, environmentId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!(await getProjectAccess(projectId, userId))?.canAccess) return NextResponse.json({ error: "无权访问该项目" }, { status: 403 });
  const environment = await prisma.deploymentEnvironment.findFirst({ where: { id: environmentId, projectId } });
  if (!environment) return NextResponse.json({ error: "部署环境不存在" }, { status: 404 });
  const health = await checkDeploymentEnvironment(environmentId, environment.currentDeploymentRunId || undefined);
  await prisma.auditLog.create({ data: { userId, projectId, actorType: "USER", action: "CHECK_DEPLOYMENT_HEALTH", resource: "DEPLOYMENT_ENVIRONMENT", resourceId: environmentId, channel: "WEB", metadata: { status: health.status, statusCode: health.statusCode, latencyMs: health.latencyMs, result: "SUCCESS" } } });
  return NextResponse.json({ health });
}
