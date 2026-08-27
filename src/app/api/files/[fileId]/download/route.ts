import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fileUser, projectFileAccess } from "@/lib/file-auth";
import { signDownload } from "@/lib/object-storage";

export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const user = await fileUser(request); if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 }); const { fileId } = await params;
  const file = await prisma.fileAsset.findUnique({ where: { id: fileId }, include: { currentVersion: true } }); if (!file || file.deletedAt || !(await projectFileAccess(user.id, file.projectId)).canRead) return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  if (!file.currentVersion) return NextResponse.json({ error: "该记录仅包含元数据，没有可下载对象" }, { status: 409 });
  return NextResponse.json({ url: await signDownload(file.currentVersion.objectKey, file.name, file.currentVersion.mimeType), expiresIn: 900 });
}
