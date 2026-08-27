import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signDownload } from "@/lib/object-storage";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params, tokenHash = createHash("sha256").update(token).digest("hex"), body = await request.json().catch(() => ({}));
  const share = await prisma.fileShare.findUnique({ where: { tokenHash }, include: { file: { include: { currentVersion: true } } } });
  if (!share || share.revokedAt || share.expiresAt <= new Date() || share.file.deletedAt || !share.file.currentVersion || (share.maxDownloads !== null && share.downloads >= share.maxDownloads)) return NextResponse.json({ error: "分享链接无效或已过期" }, { status: 410 });
  if (share.codeHash && !(await bcrypt.compare(String(body.code || ""), share.codeHash))) return NextResponse.json({ error: "提取码错误" }, { status: 403 });
  await prisma.fileShare.update({ where: { id: share.id }, data: { downloads: { increment: 1 } } });
  return NextResponse.json({ file: { name: share.file.name, size: Number(share.file.size), mimeType: share.file.mimeType }, url: await signDownload(share.file.currentVersion.objectKey, share.file.name, share.file.currentVersion.mimeType), expiresIn: 900 });
}
