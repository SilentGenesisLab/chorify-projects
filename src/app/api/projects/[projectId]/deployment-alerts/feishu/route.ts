import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validFeishuWebhook } from "@/lib/deployment-notifications";
import { encryptAppSecret } from "@/lib/security";
import { getProjectAccess } from "@/lib/project-permissions";
import { getRequestUserId } from "@/lib/team-permissions";

const schema = z.object({ webhook: z.string().trim().max(1000).optional(), secret: z.string().trim().max(300).optional(), enabled: z.boolean(), notifyDeploymentSucceeded: z.boolean().default(false) });

export async function PUT(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const userId = await getRequestUserId(request);
  const { projectId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!(await getProjectAccess(projectId, userId))?.canManage) return NextResponse.json({ error: "只有项目管理员可以配置飞书告警" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "飞书告警配置格式错误" }, { status: 400 });
  const current = await prisma.projectDeploymentSettings.findUnique({ where: { projectId } });
  if (parsed.data.webhook && !validFeishuWebhook(parsed.data.webhook)) return NextResponse.json({ error: "仅支持飞书或 Lark 官方群机器人 Webhook" }, { status: 400 });
  if (parsed.data.enabled && !parsed.data.webhook && !current?.feishuWebhookEncrypted) return NextResponse.json({ error: "启用告警前请填写群机器人 Webhook" }, { status: 400 });
  const settings = await prisma.projectDeploymentSettings.upsert({
    where: { projectId },
    create: { projectId, feishuEnabled: parsed.data.enabled, notifyDeploymentSucceeded: parsed.data.notifyDeploymentSucceeded, feishuWebhookEncrypted: parsed.data.webhook ? encryptAppSecret(parsed.data.webhook, "feishu-webhook") : null, feishuSecretEncrypted: parsed.data.secret ? encryptAppSecret(parsed.data.secret, "feishu-secret") : null },
    update: { feishuEnabled: parsed.data.enabled, notifyDeploymentSucceeded: parsed.data.notifyDeploymentSucceeded, feishuWebhookEncrypted: parsed.data.webhook ? encryptAppSecret(parsed.data.webhook, "feishu-webhook") : undefined, feishuSecretEncrypted: parsed.data.secret ? encryptAppSecret(parsed.data.secret, "feishu-secret") : undefined, feishuLastError: null },
  });
  await prisma.auditLog.create({ data: { userId, projectId, actorType: "USER", action: "UPDATE_FEISHU_DEPLOYMENT_ALERT", resource: "PROJECT", resourceId: projectId, channel: "WEB", metadata: { enabled: settings.feishuEnabled, notifyDeploymentSucceeded: settings.notifyDeploymentSucceeded, result: "SUCCESS" } } });
  return NextResponse.json({ configured: Boolean(settings.feishuWebhookEncrypted), enabled: settings.feishuEnabled, notifyDeploymentSucceeded: settings.notifyDeploymentSucceeded });
}
