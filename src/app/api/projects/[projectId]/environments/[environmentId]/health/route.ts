import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProjectAccess } from "@/lib/project-permissions";
import { getRequestUserId } from "@/lib/team-permissions";

export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string; environmentId: string }> }) {
  const userId = await getRequestUserId(request);
  const { projectId, environmentId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!(await getProjectAccess(projectId, userId))?.canAccess) return NextResponse.json({ error: "无权访问该项目" }, { status: 403 });
  const environment = await prisma.deploymentEnvironment.findFirst({ where: { id: environmentId, projectId }, include: { healthChecks: { orderBy: { checkedAt: "desc" }, take: 10080 } } });
  if (!environment) return NextResponse.json({ error: "部署环境不存在" }, { status: 404 });
  const now = Date.now();
  const ratio = (ms: number) => {
    const items = environment.healthChecks.filter((item) => now - item.checkedAt.getTime() <= ms);
    return items.length ? Math.round(items.filter((item) => item.status === "HEALTHY").length / items.length * 10000) / 100 : null;
  };
  return NextResponse.json({ environment: { ...environment, uptime24h: ratio(86_400_000), uptime7d: ratio(7 * 86_400_000) } });
}
