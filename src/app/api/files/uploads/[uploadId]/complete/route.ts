import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fileUser } from "@/lib/file-auth";
import { finishMultipart } from "@/lib/object-storage";

const schema = z.object({ parts: z.array(z.object({ partNumber: z.number().int().positive(), etag: z.string().min(1) })).min(1), sha256: z.string().regex(/^[a-fA-F0-9]{64}$/).optional() });
export async function POST(request: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const user = await fileUser(request, "file:create"); if (!user) return NextResponse.json({ error: "请先登录或提供有效 API Key" }, { status: 401 });
  const { uploadId } = await params, input = schema.safeParse(await request.json()); if (!input.success) return NextResponse.json({ error: "分片信息无效" }, { status: 400 });
  const upload = await prisma.fileUploadSession.findFirst({ where: { id: uploadId, userId: user.id, status: "PENDING", expiresAt: { gt: new Date() } } }); if (!upload || !upload.fileId) return NextResponse.json({ error: "上传会话不存在或已过期" }, { status: 404 });
  try { await finishMultipart(upload.objectKey, upload.multipartId, input.data.parts); } catch { return NextResponse.json({ error: "合并上传分片失败，请重试" }, { status: 502 }); }
  const file = await prisma.$transaction(async (tx) => {
    const existing = await tx.fileAsset.findUnique({ where: { id: upload.fileId! }, include: { _count: { select: { versions: true } } } });
    const asset = existing || await tx.fileAsset.create({ data: { id: upload.fileId!, projectId: upload.projectId, folderId: upload.folderId, creatorId: user.id, name: upload.name, mimeType: upload.mimeType, size: upload.size, storageKey: upload.objectKey, tags: [] } });
    const version = await tx.fileVersion.create({ data: { fileId: asset.id, version: existing ? existing._count.versions + 1 : 1, objectKey: upload.objectKey, originalName: upload.name, mimeType: upload.mimeType, size: upload.size, sha256: input.data.sha256?.toLowerCase(), uploaderId: user.id } });
    await tx.fileAsset.update({ where: { id: asset.id }, data: { currentVersionId: version.id, mimeType: version.mimeType, size: version.size, storageKey: version.objectKey } });
    await tx.fileUploadSession.update({ where: { id: upload.id }, data: { status: "COMPLETED" } });
    await tx.auditLog.create({ data: { userId: user.id, projectId: upload.projectId, actorType: "USER", action: existing ? "UPLOAD_FILE_VERSION" : "UPLOAD_FILE", resource: "FILE", resourceId: asset.id, channel: "WEB", metadata: { projectId: upload.projectId, version: version.version, size: Number(version.size) } } });
    return asset;
  });
  return NextResponse.json({ file: { id: file.id, name: file.name } });
}
