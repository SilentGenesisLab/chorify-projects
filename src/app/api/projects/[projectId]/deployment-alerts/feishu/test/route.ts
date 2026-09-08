import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendFeishuWebhook } from "@/lib/deployment-notifications";
import { decryptAppSecret } from "@/lib/security";
import { getProjectAccess } from "@/lib/project-permissions";
import { getRequestUserId } from "@/lib/team-permissions";

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const userId = await getRequestUserId(request);
  const { projectId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!(await getProjectAccess(projectId, userId))?.canManage) return NextResponse.json({ error: "只有项目管理员可以测试飞书告警" }, { status: 403 });
  const [project, settings] = await Promise.all([prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }), prisma.projectDeploymentSettings.findUnique({ where: { projectId } })]);
  const webhook = settings?.feishuWebhookEncrypted ? decryptAppSecret(settings.feishuWebhookEncrypted, "feishu-webhook") : null;
  const secret = settings?.feishuSecretEncrypted ? decryptAppSecret(settings.feishuSecretEncrypted, "feishu-secret") : "";
  if (!webhook) return NextResponse.json({ error: "请先保存飞书机器人配置" }, { status: 409 });
  try {
    await sendFeishuWebhook(webhook, secret || "", { title: "Chorify 发布告警测试", content: "飞书群机器人连接正常。", color: "blue", projectName: project?.name });
    await prisma.projectDeploymentSettings.update({ where: { projectId }, data: { feishuLastTestedAt: new Date(), feishuLastTestStatus: "SUCCESS", feishuLastError: null } });
    await prisma.auditLog.create({ data: { userId, projectId, actorType: "USER", action: "TEST_FEISHU_DEPLOYMENT_ALERT", resource: "PROJECT", resourceId: projectId, channel: "WEB", metadata: { result: "SUCCESS" } } });
    return NextResponse.json({ ok: true });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "飞书测试消息发送失败";
    await prisma.projectDeploymentSettings.update({ where: { projectId }, data: { feishuLastTestedAt: new Date(), feishuLastTestStatus: "FAILED", feishuLastError: error } });
    return NextResponse.json({ error }, { status: 502 });
  }
}
