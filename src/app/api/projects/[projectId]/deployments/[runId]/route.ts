import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deploymentInclude } from "@/lib/deployment-run";
import { getProjectAccess } from "@/lib/project-permissions";
import { getRequestUserId } from "@/lib/team-permissions";

export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string; runId: string }> }) {
  const userId = await getRequestUserId(request);
  const { projectId, runId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!(await getProjectAccess(projectId, userId))?.canAccess) return NextResponse.json({ error: "无权访问该项目" }, { status: 403 });
  const run = await prisma.deploymentRun.findFirst({ where: { id: runId, projectId }, include: deploymentInclude });
  return run ? NextResponse.json({ run }) : NextResponse.json({ error: "发布任务不存在" }, { status: 404 });
}
