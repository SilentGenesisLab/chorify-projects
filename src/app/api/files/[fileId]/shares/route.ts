import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fileScopeAccess, fileUser } from "@/lib/file-auth";

export async function POST(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const user = await fileUser(request); if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 }); const { fileId } = await params;
  const input = z.object({ expiresInDays: z.number().int().min(1).max(30), code: z.string().min(4).max(20).optional(), maxDownloads: z.number().int().min(1).max(10000).nullable().optional() }).safeParse(await request.json()); if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message }, { status: 400 });
  const file = await prisma.fileAsset.findUnique({ where: { id: fileId } }); if (!file || file.deletedAt) return NextResponse.json({ error: "文件不存在" }, { status: 404 }); if (!(await fileScopeAccess(user.id, file.projectId, file.creatorId)).canManage) return NextResponse.json({ error: "没有创建外部分享的权限" }, { status: 403 });
  const token = randomBytes(32).toString("base64url"), tokenHash = createHash("sha256").update(token).digest("hex"), codeHash = input.data.code ? await bcrypt.hash(input.data.code, 12) : null;
  const share = await prisma.fileShare.create({ data: { projectId: file.projectId, fileId, creatorId: user.id, tokenHash, codeHash, expiresAt: new Date(Date.now() + input.data.expiresInDays * 86400000), maxDownloads: input.data.maxDownloads || null } });
  await prisma.auditLog.create({ data: { userId: user.id, actorType: "USER", action: "CREATE_FILE_SHARE", resource: "FILE", resourceId: file.id, channel: "WEB", metadata: { shareId: share.id, expiresAt: share.expiresAt } } });
  return NextResponse.json({ share: { id: share.id, url: `${process.env.APP_URL || new URL(request.url).origin}/share/${token}`, expiresAt: share.expiresAt } }, { status: 201 });
}
