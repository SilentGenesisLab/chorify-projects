import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProjectAccess } from "@/lib/project-permissions";
import { getRequestUserId } from "@/lib/team-permissions";
import { ACTIVE_DEPLOYMENT_STATUSES } from "@/lib/deployment";
import { deploymentInclude } from "@/lib/deployment-run";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const userId = await getRequestUserId(request);
  const { projectId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const access = await getProjectAccess(projectId, userId);
  if (!access?.canAccess) return NextResponse.json({ error: "无权访问该项目" }, { status: 403 });

  const [repositories, services, environments, versions, runs, releases] = await Promise.all([
    prisma.projectRepository.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.deployableService.findMany({
      where: { projectId },
      include: { repository: { select: { id: true, fullName: true, defaultBranch: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.deploymentEnvironment.findMany({
      where: { projectId },
      include: {
        healthChecks: { orderBy: { checkedAt: "desc" }, take: 10080 },
      },
      orderBy: { kind: "asc" },
    }),
    prisma.version.findMany({
      where: { projectId },
      include: {
        components: { include: { service: { select: { id: true, name: true, slug: true } } } },
        _count: { select: { requirements: true, tasks: true, fixedBugs: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.deploymentRun.findMany({
      where: { projectId },
      include: deploymentInclude,
      orderBy: { queuedAt: "desc" },
      take: 50,
    }),
    prisma.release.findMany({
      where: { projectId },
      include: { version: { select: { id: true, name: true } }, deploymentRun: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const now = Date.now();
  const environmentMetrics = environments.map(({ healthChecks, ...environment }) => {
    const day = healthChecks.filter((item) => now - item.checkedAt.getTime() <= 86_400_000);
    const week = healthChecks.filter((item) => now - item.checkedAt.getTime() <= 7 * 86_400_000);
    const uptime = (items: typeof healthChecks) =>
      items.length ? Math.round((items.filter((item) => item.status === "HEALTHY").length / items.length) * 10000) / 100 : null;
    return { ...environment, uptime24h: uptime(day), uptime7d: uptime(week), recentChecks: healthChecks.slice(0, 30) };
  });

  return NextResponse.json({
    currentUserId: userId,
    repositories,
    services,
    environments: environmentMetrics,
    versions,
    runs,
    releases,
    permissions: { canDeploy: access.canManage, canConfigure: access.canManage },
    activeStatuses: ACTIVE_DEPLOYMENT_STATUSES,
  });
}
