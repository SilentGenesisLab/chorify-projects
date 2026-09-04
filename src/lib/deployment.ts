import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ACTIVE_DEPLOYMENT_STATUSES = [
  "QUEUED",
  "WAITING_APPROVAL",
  "DISPATCHED",
  "BUILDING",
  "DEPLOYING",
  "VERIFYING",
] as const;

export const DEPLOYMENT_STEPS = [
  ["checkout", "检出代码"],
  ["test", "测试与检查"],
  ["build", "构建镜像"],
  ["migration", "数据库迁移"],
  ["deploy", "启动备用实例"],
  ["health", "健康检查"],
  ["switch", "切换流量"],
  ["observe", "稳定性观察"],
] as const;

export type ManifestComponent = {
  serviceId: string;
  service: string;
  repository: string;
  commitSha: string;
  branch?: string | null;
};

export function deploymentManifestHash(input: {
  projectId: string;
  versionId: string;
  environmentId: string;
  components: ManifestComponent[];
}) {
  const normalized = {
    ...input,
    components: [...input.components]
      .map((item) => ({ ...item, commitSha: item.commitSha.toLowerCase() }))
      .sort((a, b) => a.serviceId.localeCompare(b.serviceId)),
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export function canApproveDeployment(input: {
  requesterId: string;
  approverId: string;
  manifestHash: string;
  approvalManifestHash: string;
  expiresAt: Date;
  now?: Date;
}) {
  if (input.requesterId === input.approverId) return "发布发起人不能审批自己的生产发布";
  if (input.expiresAt <= (input.now || new Date())) return "审批已过期，请重新发起发布";
  if (input.manifestHash !== input.approvalManifestHash) return "发布内容已变化，请重新审批";
  return null;
}

export function deploymentHealthStatus(consecutiveFailures: number, ok: boolean) {
  if (ok) return { status: "HEALTHY" as const, consecutiveFailures: 0 };
  const failures = consecutiveFailures + 1;
  return {
    status: failures >= 3 ? ("DOWN" as const) : ("DEGRADED" as const),
    consecutiveFailures: failures,
  };
}

export function migrationRisk(sql: string) {
  const normalized = sql.toUpperCase().replace(/\s+/g, " ");
  const breaking = [
    /DROP\s+(COLUMN|TABLE|TYPE)/,
    /ALTER\s+COLUMN.+SET\s+NOT\s+NULL/,
    /RENAME\s+(COLUMN|TABLE)/,
  ].some((pattern) => pattern.test(normalized));
  if (breaking) return "BREAKING" as const;
  if (/CREATE\s+TABLE|ADD\s+COLUMN|CREATE\s+(UNIQUE\s+)?INDEX/.test(normalized))
    return "BACKWARD_COMPATIBLE" as const;
  return "NONE" as const;
}

export function verifyWebhookSignature(payload: string, signature: string | null, secret: string) {
  if (!signature?.startsWith("sha256=") || !secret) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
