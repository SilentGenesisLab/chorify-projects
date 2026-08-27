import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticatedUserId } from "@/lib/web-auth";
import { API_TOKEN_PERMISSIONS } from "@/lib/api-token-permissions";

const updateSchema = z.object({
  name: z.string().trim().min(2, "名称至少 2 个字符").max(50), allProjects: z.boolean(), projectIds: z.array(z.string()).max(100).default([]),
  permissions: z.array(z.enum(API_TOKEN_PERMISSIONS)).min(1, "至少选择一项权限"), expiresAt: z.string().datetime().nullable(),
}).superRefine((value, context) => { if (!value.allProjects && value.projectIds.length === 0) context.addIssue({ code: "custom", path: ["projectIds"], message: "至少选择一个项目" }); });

export async function PATCH(request: Request, { params }: { params: Promise<{ tokenId: string }> }) {
  const userId = await authenticatedUserId(request); const { tokenId } = await params;
  if (!userId) return NextResponse.json({ error: "缺少用户会话" }, { status: 401 });
  const existing = await prisma.apiToken.findFirst({ where: { id: tokenId, userId } });
  if (!existing) return NextResponse.json({ error: "API Key 不存在" }, { status: 404 });
  if (existing.revokedAt) return NextResponse.json({ error: "已撤销的 API Key 不能编辑" }, { status: 409 });
  const input = updateSchema.safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message || "参数不正确" }, { status: 400 });
  const projectIds = input.data.allProjects ? [] : [...new Set(input.data.projectIds)];
  const count = input.data.allProjects ? 0 : await prisma.projectMember.count({ where: { userId, projectId: { in: projectIds } } });
  if (!input.data.allProjects && count !== projectIds.length) return NextResponse.json({ error: "包含无权授权的项目" }, { status: 403 });
  if (input.data.expiresAt && new Date(input.data.expiresAt) <= new Date()) return NextResponse.json({ error: "有效期必须晚于当前时间" }, { status: 400 });
  await prisma.$transaction(async (tx) => {
    await tx.apiTokenProject.deleteMany({ where: { tokenId } });
    await tx.apiToken.update({ where: { id: tokenId }, data: { name: input.data.name, allProjects: input.data.allProjects, permissions: input.data.permissions, expiresAt: input.data.expiresAt ? new Date(input.data.expiresAt) : null, projects: { create: projectIds.map((projectId) => ({ projectId })) } } });
    await tx.auditLog.create({ data: { userId, actorType: "USER", action: "UPDATE_API_TOKEN", resource: "API_TOKEN", resourceId: tokenId, channel: "WEB", metadata: { allProjects: input.data.allProjects, projectIds, permissions: input.data.permissions } } });
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ tokenId: string }> }) {
  const userId = await authenticatedUserId(request); const { tokenId } = await params;
  if (!userId) return NextResponse.json({ error: "缺少用户会话" }, { status: 401 });
  const existing = await prisma.apiToken.findFirst({ where: { id: tokenId, userId } });
  if (!existing) return NextResponse.json({ error: "API Key 不存在" }, { status: 404 });
  if (existing.revokedAt) return NextResponse.json({ ok: true });
  await prisma.$transaction([prisma.apiToken.update({ where: { id: tokenId }, data: { revokedAt: new Date() } }), prisma.auditLog.create({ data: { userId, actorType: "USER", action: "REVOKE_API_TOKEN", resource: "API_TOKEN", resourceId: tokenId, channel: "WEB" } })]);
  return NextResponse.json({ ok: true });
}
