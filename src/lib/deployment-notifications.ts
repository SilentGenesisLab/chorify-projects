import { createHmac } from "node:crypto";
import type { DeploymentNotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptAppSecret } from "@/lib/security";

export type DeploymentAlertPayload = {
  title: string;
  content: string;
  color?: "red" | "green" | "orange" | "blue";
  projectName?: string;
  environmentName?: string;
  versionName?: string;
  failureStep?: string;
  operatorName?: string;
  environmentUrl?: string;
  actionsUrl?: string;
};

export function validFeishuWebhook(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["open.feishu.cn", "open.larksuite.com"].includes(url.hostname) && url.pathname.startsWith("/open-apis/bot/v2/hook/");
  } catch {
    return false;
  }
}

export function feishuSignature(timestamp: number, secret: string) {
  return createHmac("sha256", `${timestamp}\n${secret}`).update("").digest("base64");
}

export async function sendFeishuWebhook(webhook: string, secret: string, payload: DeploymentAlertPayload) {
  if (!validFeishuWebhook(webhook)) throw new Error("飞书机器人地址无效");
  const timestamp = Math.floor(Date.now() / 1000);
  const fields = [
    payload.projectName && `**项目：** ${payload.projectName}`,
    payload.environmentName && `**环境：** ${payload.environmentName}`,
    payload.versionName && `**版本：** ${payload.versionName}`,
    payload.failureStep && `**阶段：** ${payload.failureStep}`,
    payload.operatorName && `**操作者：** ${payload.operatorName}`,
    `**时间：** ${new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "medium", timeStyle: "medium" }).format(new Date())}`,
    payload.content,
  ].filter(Boolean).join("\n");
  const links = [
    payload.environmentUrl && `[打开环境](${payload.environmentUrl})`,
    payload.actionsUrl && `[查看 GitHub Actions](${payload.actionsUrl})`,
  ].filter(Boolean).join("　");
  const body: Record<string, unknown> = {
    msg_type: "interactive",
    card: {
      header: { template: payload.color || "blue", title: { tag: "plain_text", content: payload.title } },
      elements: [{ tag: "markdown", content: `${fields}${links ? `\n\n${links}` : ""}` }],
    },
  };
  if (secret) Object.assign(body, { timestamp: String(timestamp), sign: feishuSignature(timestamp, secret) });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
    const result = await response.json().catch(() => ({})) as { code?: number; StatusCode?: number; msg?: string };
    if (!response.ok || (result.code ?? result.StatusCode ?? 0) !== 0) throw new Error(result.msg || `飞书返回 HTTP ${response.status}`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function enqueueDeploymentNotification(input: {
  projectId: string;
  environmentId?: string | null;
  deploymentRunId?: string | null;
  eventKey: string;
  type: DeploymentNotificationType;
  payload: DeploymentAlertPayload;
}) {
  const settings = await prisma.projectDeploymentSettings.findUnique({ where: { projectId: input.projectId } });
  if (!settings?.feishuEnabled || !settings.feishuWebhookEncrypted) return null;
  if (input.type === "DEPLOYMENT_SUCCEEDED" && !settings.notifyDeploymentSucceeded) return null;
  return prisma.deploymentNotificationDelivery.upsert({
    where: { eventKey: input.eventKey },
    create: { ...input, payload: input.payload as Prisma.InputJsonValue },
    update: { payload: input.payload as Prisma.InputJsonValue },
  });
}

export async function deliverPendingDeploymentNotifications(limit = 20) {
  const items = await prisma.deploymentNotificationDelivery.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  for (const item of items) {
    const settings = await prisma.projectDeploymentSettings.findUnique({ where: { projectId: item.projectId } });
    const webhook = settings?.feishuWebhookEncrypted ? decryptAppSecret(settings.feishuWebhookEncrypted, "feishu-webhook") : null;
    const secret = settings?.feishuSecretEncrypted ? decryptAppSecret(settings.feishuSecretEncrypted, "feishu-secret") : "";
    try {
      if (!settings?.feishuEnabled || !webhook) throw new Error("飞书机器人未启用");
      await sendFeishuWebhook(webhook, secret || "", item.payload as DeploymentAlertPayload);
      await prisma.deploymentNotificationDelivery.update({ where: { id: item.id }, data: { status: "SENT", attempts: { increment: 1 }, sentAt: new Date(), lastError: null } });
    } catch (cause) {
      const attempts = item.attempts + 1;
      const delays = [1, 5, 15];
      await prisma.deploymentNotificationDelivery.update({
        where: { id: item.id },
        data: {
          status: attempts > delays.length ? "FAILED" : "PENDING",
          attempts,
          lastError: cause instanceof Error ? cause.message.slice(0, 1000) : "飞书发送失败",
          nextAttemptAt: new Date(Date.now() + delays[Math.min(attempts - 1, delays.length - 1)] * 60_000),
        },
      });
    }
  }
  return { processed: items.length };
}
