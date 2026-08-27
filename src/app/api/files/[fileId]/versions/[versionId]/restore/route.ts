import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fileUser, projectFileAccess } from "@/lib/file-auth";

export async function POST(request: Request, { params }: { params: Promise<{ fileId: string; versionId: string }> }) {
  const user = await fileUser(request); if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 }); const { fileId, versionId } = await params;
  const version = await prisma.fileVersion.findFirst({ where: { id: versionId, fileId }, include: { file: true } }); if (!version) return NextResponse.json({ error: "版本不存在" }, { status: 404 }); const permission = await projectFileAccess(user.id, version.file.projectId); if (!permission.canManage && version.file.creatorId !== user.id) return NextResponse.json({ error: "没有恢复版本的权限" }, { status: 403 });
  await prisma.fileAsset.update({ where: { id: fileId }, data: { currentVersionId: version.id, mimeType: version.mimeType, size: version.size, storageKey: version.objectKey } }); return NextResponse.json({ ok: true });
}
