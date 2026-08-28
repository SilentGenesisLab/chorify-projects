import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fileScopeAccess, fileUser, jsonBigInt } from "@/lib/file-auth";
import { deleteObject } from "@/lib/object-storage";

export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const user = await fileUser(request); if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 }); const { fileId } = await params;
  const file = await prisma.fileAsset.findUnique({ where: { id: fileId }, include: { project: { select: { id: true, name: true } }, folder: true, creator: { select: { id: true, name: true } }, versions: { include: { uploader: { select: { name: true } } }, orderBy: { version: "desc" } }, links: true, shares: { where: { revokedAt: null }, orderBy: { createdAt: "desc" } } } });
  if (!file || !(await fileScopeAccess(user.id, file.projectId, file.creatorId)).canRead) return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  return NextResponse.json({ file: { ...file, size: jsonBigInt(file.size), versions: file.versions.map((version) => ({ ...version, size: jsonBigInt(version.size) })) } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const user = await fileUser(request); if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 }); const { fileId } = await params;
  const input = z.object({ name: z.string().trim().min(1).max(240).optional(), folderId: z.string().nullable().optional(), tags: z.array(z.string().trim().min(1).max(30)).max(20).optional() }).safeParse(await request.json()); if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message }, { status: 400 });
  const file = await prisma.fileAsset.findUnique({ where: { id: fileId } }); if (!file) return NextResponse.json({ error: "文件不存在" }, { status: 404 }); const permission = await fileScopeAccess(user.id, file.projectId, file.creatorId); if (!permission.canManage) return NextResponse.json({ error: "没有修改文件的权限" }, { status: 403 });
  if (input.data.folderId && !await prisma.fileFolder.findFirst({ where: { id: input.data.folderId, projectId: file.projectId, deletedAt: null } })) return NextResponse.json({ error: "目标文件夹不存在" }, { status: 404 });
  const updated = await prisma.fileAsset.update({ where: { id: fileId }, data: input.data }); return NextResponse.json({ file: updated });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const user = await fileUser(request); if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 }); const { fileId } = await params;
  const file = await prisma.fileAsset.findUnique({ where: { id: fileId } }); if (!file) return NextResponse.json({ error: "文件不存在" }, { status: 404 }); const permission = await fileScopeAccess(user.id, file.projectId, file.creatorId); if (!permission.canManage) return NextResponse.json({ error: "没有删除文件的权限" }, { status: 403 });
  const permanent = new URL(request.url).searchParams.get("permanent") === "1";
  if (permanent) { const versions = await prisma.fileVersion.findMany({ where: { fileId }, select: { objectKey: true } }); await Promise.all(versions.map(version => deleteObject(version.objectKey).catch(() => undefined))); await prisma.fileAsset.delete({ where: { id: fileId } }); return NextResponse.json({ ok: true, permanent: true }); }
  await prisma.fileAsset.update({ where: { id: fileId }, data: { deletedAt: new Date() } }); await prisma.fileShare.updateMany({ where: { fileId, revokedAt: null }, data: { revokedAt: new Date() } }); return NextResponse.json({ ok: true });
}
