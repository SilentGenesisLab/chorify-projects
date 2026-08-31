import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createPersonalToken } from "@/lib/security";
import { authenticatedUserId } from "@/lib/web-auth";
import { API_TOKEN_PERMISSIONS } from "@/lib/api-token-permissions";

const inputSchema = z.object({
  name: z.string().trim().min(2, "名称至少 2 个字符").max(50, "名称最多 50 个字符"),
  permissions: z.array(z.enum(API_TOKEN_PERMISSIONS)).min(1, "至少选择一项权限"),
  expiresAt: z.string().datetime().nullable(),
});

export async function GET(request: Request) {
  const userId = await authenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "缺少用户会话" }, { status: 401 });
  const tokens = await prisma.apiToken.findMany({ where: { userId }, select: { id: true, name: true, prefix: true, permissions: true, expiresAt: true, revokedAt: true, lastUsedAt: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: "desc" } });
  // Keep the legacy presentation fields during the UI migration. They no
  // longer represent persisted scopes: every key follows the user's live
  // access, and an empty project list is intentional.
  return NextResponse.json({
    tokens: tokens.map((token) => ({
      ...token,
      scope: "ALL_USER_RESOURCES",
      allProjects: true,
      projects: [],
    })),
    projects: [],
  });
}

export async function POST(request: Request) {
  const userId = await authenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "缺少用户会话" }, { status: 401 });
  const input = inputSchema.safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message || "参数不正确" }, { status: 400 });
  if (input.data.expiresAt && new Date(input.data.expiresAt) <= new Date()) return NextResponse.json({ error: "有效期必须晚于当前时间" }, { status: 400 });
  const generated = createPersonalToken();
  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.apiToken.create({ data: { userId, name: input.data.name, permissions: input.data.permissions, expiresAt: input.data.expiresAt ? new Date(input.data.expiresAt) : null, prefix: generated.prefix, tokenHash: generated.tokenHash } });
    await tx.auditLog.create({ data: { userId, actorType: "USER", action: "CREATE_API_TOKEN", resource: "API_TOKEN", resourceId: created.id, channel: "WEB", metadata: { scope: "ALL_USER_RESOURCES", permissions: input.data.permissions } } });
    return created;
  });
  return NextResponse.json({ id: record.id, token: generated.token, prefix: record.prefix }, { status: 201 });
}
