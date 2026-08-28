import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticatedUserId } from "@/lib/web-auth";
import { API_TOKEN_PERMISSIONS } from "@/lib/api-token-permissions";

const updateSchema = z.object({
  name: z.string().trim().min(2, "名称至少 2 个字符").max(50),
  permissions: z.array(z.enum(API_TOKEN_PERMISSIONS)).min(1, "至少选择一项权限"), expiresAt: z.string().datetime().nullable(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ tokenId: string }> }) {
  const userId = await authenticatedUserId(request); const { tokenId } = await params;
  if (!userId) return NextResponse.json({ error: "缺少用户会话" }, { status: 401 });
  const existing = await prisma.apiToken.findFirst({ where: { id: tokenId, userId } });
  if (!existing) return NextResponse.json({ error: "API Key 不存在" }, { status: 404 });
  if (existing.revokedAt) return NextResponse.json({ error: "已撤销的 API Key 不能编辑" }, { status: 409 });
  const input = updateSchema.safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message || "参数不正确" }, { status: 400 });
  if (input.data.expiresAt && new Date(input.data.expiresAt) <= new Date()) return NextResponse.json({ error: "有效期必须晚于当前时间" }, { status: 400 });
  await prisma.$transaction(async (tx) => {
    await tx.apiToken.update({ where: { id: tokenId }, data: { name: input.data.name, permissions: input.data.permissions, expiresAt: input.data.expiresAt ? new Date(input.data.expiresAt) : null } });
    await tx.auditLog.create({ data: { userId, actorType: "USER", action: "UPDATE_API_TOKEN", resource: "API_TOKEN", resourceId: tokenId, channel: "WEB", metadata: { scope: "ALL_USER_RESOURCES", permissions: input.data.permissions } } });
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
