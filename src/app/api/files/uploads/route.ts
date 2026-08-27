import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiTokenAllowsProject, fileUser, hostDiskAllowsUpload, MAX_FILE_SIZE, projectFileAccess, storageUsage, STORAGE_UPLOAD_STOP } from "@/lib/file-auth";
import { startMultipart } from "@/lib/object-storage";

const schema = z.object({ projectId: z.string().min(1), folderId: z.string().nullable().optional(), fileId: z.string().optional(), name: z.string().trim().min(1).max(240), mimeType: z.string().max(200).default("application/octet-stream"), size: z.number().int().positive() });
export async function POST(request: Request) {
  const user = await fileUser(request, "file:create"); if (!user) return NextResponse.json({ error: "请先登录或提供有效 API Key" }, { status: 401 });
  const input = schema.safeParse(await request.json()); if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message || "上传信息不完整" }, { status: 400 });
  const size = BigInt(input.data.size); if (size > MAX_FILE_SIZE) return NextResponse.json({ error: "单个文件不能超过 2GB" }, { status: 413 });
  const permission = await projectFileAccess(user.id, input.data.projectId); if (!permission.canWrite) return NextResponse.json({ error: "没有上传权限" }, { status: 403 });
  if (!apiTokenAllowsProject(user, input.data.projectId)) return NextResponse.json({ error: "API Key 未授权访问该项目" }, { status: 403 });
  if (input.data.folderId && !await prisma.fileFolder.findFirst({ where: { id: input.data.folderId, projectId: input.data.projectId, deletedAt: null } })) return NextResponse.json({ error: "目标文件夹不存在" }, { status: 404 });
  if (input.data.fileId && !await prisma.fileAsset.findFirst({ where: { id: input.data.fileId, projectId: input.data.projectId, deletedAt: null } })) return NextResponse.json({ error: "目标文件不存在" }, { status: 404 });
  const used = await storageUsage(); if (used + size > STORAGE_UPLOAD_STOP) return NextResponse.json({ error: "存储空间已达到上传保护线，请清理后重试" }, { status: 507 });
  if (!await hostDiskAllowsUpload()) return NextResponse.json({ error: "服务器磁盘可用空间不足 10GB，上传已暂停" }, { status: 507 });
  const fileId = input.data.fileId || randomUUID(), objectKey = `projects/${input.data.projectId}/${fileId}/${randomUUID()}`;
  try {
    const multipartId = await startMultipart(objectKey, input.data.mimeType || "application/octet-stream");
    const upload = await prisma.fileUploadSession.create({ data: { projectId: input.data.projectId, folderId: input.data.folderId || null, fileId, userId: user.id, name: input.data.name, mimeType: input.data.mimeType || "application/octet-stream", size, objectKey, multipartId, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
    return NextResponse.json({ upload: { id: upload.id, fileId, partSize: 10 * 1024 * 1024, expiresAt: upload.expiresAt } }, { status: 201 });
  } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "无法初始化上传" }, { status: 503 }); }
}
