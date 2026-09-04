import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getProjectAccess } from "@/lib/project-permissions";
import { getRequestUserId } from "@/lib/team-permissions";

const schema = z.object({
  repository: z.object({
    installationId: z.string().trim().min(1).max(40),
    owner: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(100),
    defaultBranch: z.string().trim().min(1).max(100).default("main"),
    workflowPath: z.string().trim().min(1).max(200).default("chorify-deploy.yml"),
  }),
  service: z.object({
    name: z.string().trim().min(1).max(80),
    slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,49}$/),
    kind: z.enum(["WEB", "API", "WORKER"]).default("WEB"),
    dockerfilePath: z.string().trim().min(1).max(300).default("Dockerfile"),
    buildContext: z.string().trim().min(1).max(300).default("."),
    healthPath: z.string().trim().startsWith("/").max(300).default("/api/health"),
    internalPort: z.number().int().min(1).max(65535).default(3000),
  }),
  environment: z.object({
    name: z.string().trim().min(1).max(80),
    slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,49}$/),
    kind: z.enum(["STAGING", "PRODUCTION"]),
    url: z.string().url().startsWith("https://"),
    githubEnvironment: z.string().trim().min(1).max(100),
    healthPath: z.string().trim().startsWith("/").max(300).default("/api/health"),
  }),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const userId = await getRequestUserId(request);
  const { projectId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const access = await getProjectAccess(projectId, userId);
  if (!access?.canManage) return NextResponse.json({ error: "只有项目管理员可以配置 CI/CD" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "配置不完整" }, { status: 400 });
  const { repository: repoInput, service: serviceInput, environment: environmentInput } = parsed.data;
  const fullName = `${repoInput.owner}/${repoInput.name}`;
  const result = await prisma.$transaction(async (tx) => {
    const repository = await tx.projectRepository.upsert({
      where: { projectId_fullName: { projectId, fullName } },
      create: { projectId, fullName, ...repoInput },
      update: { ...repoInput, status: "ACTIVE" },
    });
    const service = await tx.deployableService.upsert({
      where: { projectId_slug: { projectId, slug: serviceInput.slug } },
      create: { projectId, repositoryId: repository.id, ...serviceInput },
      update: { repositoryId: repository.id, ...serviceInput, enabled: true },
    });
    const environment = await tx.deploymentEnvironment.upsert({
      where: { projectId_slug: { projectId, slug: environmentInput.slug } },
      create: { projectId, ...environmentInput },
      update: { ...environmentInput, enabled: true },
    });
    return { repository, service, environment };
  });
  await prisma.auditLog.create({
    data: { userId, projectId, actorType: "USER", action: "UPDATE_DEPLOYMENT_CONFIG", resource: "PROJECT", resourceId: projectId, channel: "WEB", metadata: { fullName, service: serviceInput.slug, environment: environmentInput.slug, result: "SUCCESS" } },
  });
  return NextResponse.json(result);
}
