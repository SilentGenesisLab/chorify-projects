import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { invalidDeploymentText } from "@/lib/deployment";
import { getProjectAccess } from "@/lib/project-permissions";
import { getRequestUserId } from "@/lib/team-permissions";

const schema = z.object({ guideMarkdown: z.string().max(20_000).refine((value) => !invalidDeploymentText(value), "说明中包含无效乱码字符") });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const userId = await getRequestUserId(request);
  const { projectId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!(await getProjectAccess(projectId, userId))?.canManage) return NextResponse.json({ error: "只有项目管理员可以编辑部署说明" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "部署说明格式错误" }, { status: 400 });
  const settings = await prisma.projectDeploymentSettings.upsert({ where: { projectId }, create: { projectId, guideMarkdown: parsed.data.guideMarkdown }, update: { guideMarkdown: parsed.data.guideMarkdown } });
  await prisma.auditLog.create({ data: { userId, projectId, actorType: "USER", action: "UPDATE_DEPLOYMENT_GUIDE", resource: "PROJECT", resourceId: projectId, channel: "WEB", metadata: { result: "SUCCESS" } } });
  return NextResponse.json({ guideMarkdown: settings.guideMarkdown });
}
