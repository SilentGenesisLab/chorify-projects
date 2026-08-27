import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createPersonalToken } from "@/lib/security";
import { authenticatedUserId } from "@/lib/web-auth";
import { API_TOKEN_PERMISSIONS } from "@/lib/api-token-permissions";

const inputSchema = z.object({
  name: z.string().trim().min(2, "名称至少 2 个字符").max(50, "名称最多 50 个字符"),
  allProjects: z.boolean(), projectIds: z.array(z.string()).max(100).default([]),
  permissions: z.array(z.enum(API_TOKEN_PERMISSIONS)).min(1, "至少选择一项权限"),
  expiresAt: z.string().datetime().nullable(),
}).superRefine((value, context) => { if (!value.allProjects && value.projectIds.length === 0) context.addIssue({ code: "custom", path: ["projectIds"], message: "至少选择一个项目" }); });

async function authorizedProjectIds(userId: string, allProjects: boolean, requested: string[]) {
  if (allProjects) return [];
  const projectIds = [...new Set(requested)];
  const count = await prisma.projectMember.count({ where: { userId, projectId: { in: projectIds } } });
  return count === projectIds.length ? projectIds : null;
}

export async function GET(request: Request) {
  const userId = await authenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "缺少用户会话" }, { status: 401 });
  const [tokens, memberships] = await Promise.all([
    prisma.apiToken.findMany({ where: { userId }, select: { id: true, name: true, prefix: true, allProjects: true, permissions: true, expiresAt: true, revokedAt: true, lastUsedAt: true, createdAt: true, updatedAt: true, projects: { select: { project: { select: { id: true, code: true, name: true } } } } }, orderBy: { createdAt: "desc" } }),
    prisma.projectMember.findMany({ where: { userId }, select: { project: { select: { id: true, code: true, name: true } } }, orderBy: { project: { name: "asc" } } }),
  ]);
  return NextResponse.json({ tokens: tokens.map((token) => ({ ...token, projects: token.projects.map((item) => item.project) })), projects: memberships.map((item) => item.project) });
}

export async function POST(request: Request) {
  const userId = await authenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "缺少用户会话" }, { status: 401 });
  const input = inputSchema.safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message || "参数不正确" }, { status: 400 });
  const projectIds = await authorizedProjectIds(userId, input.data.allProjects, input.data.projectIds);
  if (!projectIds) return NextResponse.json({ error: "包含无权授权的项目" }, { status: 403 });
  if (input.data.expiresAt && new Date(input.data.expiresAt) <= new Date()) return NextResponse.json({ error: "有效期必须晚于当前时间" }, { status: 400 });
  const generated = createPersonalToken();
  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.apiToken.create({ data: { userId, name: input.data.name, allProjects: input.data.allProjects, permissions: input.data.permissions, expiresAt: input.data.expiresAt ? new Date(input.data.expiresAt) : null, prefix: generated.prefix, tokenHash: generated.tokenHash, projects: { create: projectIds.map((projectId) => ({ projectId })) } } });
    await tx.auditLog.create({ data: { userId, actorType: "USER", action: "CREATE_API_TOKEN", resource: "API_TOKEN", resourceId: created.id, channel: "WEB", metadata: { allProjects: input.data.allProjects, projectIds, permissions: input.data.permissions } } });
    return created;
  });
  return NextResponse.json({ id: record.id, token: generated.token, prefix: record.prefix }, { status: 201 });
}
