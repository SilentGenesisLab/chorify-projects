import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { invalidDeploymentText } from "@/lib/deployment";
import { getProjectAccess } from "@/lib/project-permissions";
import { getRequestUserId } from "@/lib/team-permissions";

const text = (min: number, max: number) => z.string().trim().min(min).max(max).refine((value) => !invalidDeploymentText(value), "内容包含无效乱码字符");
const slug = text(1, 50).regex(/^[a-z0-9][a-z0-9-]{0,49}$/);
const url = z.string().url().startsWith("https://").refine((value) => !invalidDeploymentText(value), "地址包含无效乱码字符");
const repositorySchema = z.object({ installationId: text(1, 40), owner: text(1, 100), name: text(1, 100), defaultBranch: text(1, 100).default("main"), workflowPath: text(1, 200).default("chorify-deploy.yml") });
const serviceSchema = z.object({ name: text(1, 80), slug, kind: z.enum(["WEB", "API", "WORKER"]).default("WEB"), dockerfilePath: text(1, 300).default("Dockerfile"), buildContext: text(1, 300).default("."), healthPath: text(1, 300).startsWith("/"), internalPort: z.number().int().min(1).max(65535).default(3000) });
const environmentSchema = z.object({ name: text(1, 80), slug, kind: z.enum(["STAGING", "PRODUCTION"]), url, githubEnvironment: text(1, 100), healthPath: text(1, 300).startsWith("/").default("/api/health") });
const compositeSchema = z.object({ repository: repositorySchema, service: serviceSchema, environment: environmentSchema });
const patchSchema = z.object({ resource: z.enum(["repository", "service", "environment"]), resourceId: z.string().min(1), data: z.record(z.string(), z.unknown()) });

async function access(request: NextRequest, projectId: string) {
  const userId = await getRequestUserId(request);
  if (!userId) return { error: NextResponse.json({ error: "请先登录" }, { status: 401 }) };
  const permission = await getProjectAccess(projectId, userId);
  if (!permission?.canAccess) return { error: NextResponse.json({ error: "无权访问该项目" }, { status: 403 }) };
  return { userId, permission };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const auth = await access(request, projectId);
  if (auth.error) return auth.error;
  const [repositories, services, environments, settings] = await Promise.all([
    prisma.projectRepository.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.deployableService.findMany({ where: { projectId }, include: { repository: { select: { id: true, fullName: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.deploymentEnvironment.findMany({ where: { projectId }, orderBy: [{ kind: "asc" }, { createdAt: "asc" }] }),
    prisma.projectDeploymentSettings.findUnique({ where: { projectId } }),
  ]);
  const staging = environments.filter((item) => item.kind === "STAGING");
  const production = environments.filter((item) => item.kind === "PRODUCTION");
  const readiness = [
    { id: "github-app", title: "GitHub App / 仓库授权", status: (process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY) || process.env.GITHUB_BOOTSTRAP_TOKEN ? "READY" : "MISSING", detail: repositories.length ? `${repositories.length} 个仓库已登记` : "尚未连接仓库" },
    { id: "repository", title: "代码仓库与工作流", status: repositories.some((item) => item.status === "ACTIVE") ? "READY" : "MISSING", detail: repositories[0]?.lastError || "需要仓库、候选分支和 Actions 工作流" },
    { id: "service", title: "Docker 服务", status: services.some((item) => item.enabled) ? "READY" : "MISSING", detail: services.length ? `${services.length} 个服务已登记` : "需要 Dockerfile、构建上下文和健康路径" },
    { id: "staging", title: "预发布环境", status: staging.some((item) => item.enabled && item.healthStatus === "HEALTHY") ? "READY" : staging.length ? "WARNING" : "MISSING", detail: staging.length ? `健康状态：${staging[0].healthStatus}` : "尚未配置预发布环境" },
    { id: "production", title: "生产环境", status: production.some((item) => item.enabled && item.healthStatus === "HEALTHY") ? "READY" : production.length ? "WARNING" : "MISSING", detail: production.length ? `健康状态：${production[0].healthStatus}` : "生产环境未配置" },
    { id: "feishu", title: "飞书故障告警", status: settings?.feishuEnabled ? "READY" : "MISSING", detail: settings?.feishuEnabled ? "项目机器人已启用" : "尚未配置项目群机器人" },
  ];
  return NextResponse.json({ repositories, services, environments, readiness, guideMarkdown: settings?.guideMarkdown || "", feishu: { configured: Boolean(settings?.feishuWebhookEncrypted), enabled: settings?.feishuEnabled || false, notifyDeploymentSucceeded: settings?.notifyDeploymentSucceeded || false, lastTestedAt: settings?.feishuLastTestedAt, lastTestStatus: settings?.feishuLastTestStatus, lastError: settings?.feishuLastError }, requiredSecrets: ["CHORIFY_CALLBACK_URL", "CHORIFY_DEPLOY_CALLBACK_SECRET", "DEPLOY_SSH_PRIVATE_KEY", "DEPLOY_KNOWN_HOSTS", "DEPLOY_USER", "DEPLOY_HOST"], permissions: { canConfigure: Boolean(auth.permission?.canManage) } });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const auth = await access(request, projectId);
  if (auth.error) return auth.error;
  if (!auth.permission?.canManage) return NextResponse.json({ error: "只有项目管理员可以配置 CI/CD" }, { status: 403 });
  const parsed = compositeSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "配置不完整" }, { status: 400 });
  const { repository: repoInput, service: serviceInput, environment: environmentInput } = parsed.data;
  const fullName = `${repoInput.owner}/${repoInput.name}`;
  const result = await prisma.$transaction(async (tx) => {
    const repository = await tx.projectRepository.upsert({ where: { projectId_fullName: { projectId, fullName } }, create: { projectId, fullName, ...repoInput }, update: { ...repoInput, status: "ACTIVE", lastError: null } });
    const service = await tx.deployableService.upsert({ where: { projectId_slug: { projectId, slug: serviceInput.slug } }, create: { projectId, repositoryId: repository.id, ...serviceInput }, update: { repositoryId: repository.id, ...serviceInput, enabled: true } });
    const environment = await tx.deploymentEnvironment.upsert({ where: { projectId_slug: { projectId, slug: environmentInput.slug } }, create: { projectId, ...environmentInput }, update: { ...environmentInput, enabled: true } });
    return { repository, service, environment };
  });
  await prisma.auditLog.create({ data: { userId: auth.userId, projectId, actorType: "USER", action: "UPDATE_DEPLOYMENT_CONFIG", resource: "PROJECT", resourceId: projectId, channel: "WEB", metadata: { fullName, service: serviceInput.slug, environment: environmentInput.slug, result: "SUCCESS" } } });
  return NextResponse.json(result);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const auth = await access(request, projectId);
  if (auth.error) return auth.error;
  if (!auth.permission?.canManage) return NextResponse.json({ error: "只有项目管理员可以修改 CI/CD 配置" }, { status: 403 });
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "配置参数错误" }, { status: 400 });
  const { resource, resourceId, data } = parsed.data;
  if (resource === "repository") {
    const input = repositorySchema.extend({ status: z.enum(["ACTIVE", "DISCONNECTED", "ERROR"]) }).safeParse(data);
    if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message }, { status: 400 });
    await prisma.projectRepository.updateMany({ where: { id: resourceId, projectId }, data: { ...input.data, fullName: `${input.data.owner}/${input.data.name}` } });
  } else if (resource === "service") {
    const input = serviceSchema.extend({ repositoryId: z.string().min(1), enabled: z.boolean() }).safeParse(data);
    if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message }, { status: 400 });
    await prisma.deployableService.updateMany({ where: { id: resourceId, projectId }, data: input.data });
  } else {
    const input = environmentSchema.extend({ enabled: z.boolean() }).safeParse(data);
    if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message }, { status: 400 });
    await prisma.deploymentEnvironment.updateMany({ where: { id: resourceId, projectId }, data: input.data });
  }
  await prisma.auditLog.create({ data: { userId: auth.userId, projectId, actorType: "USER", action: "EDIT_DEPLOYMENT_RESOURCE", resource: resource.toUpperCase(), resourceId, channel: "WEB", metadata: { result: "SUCCESS" } } });
  return NextResponse.json({ ok: true });
}
