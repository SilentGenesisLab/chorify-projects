import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fileUser, projectFileAccess } from "@/lib/file-auth";

export async function DELETE(request: Request, { params }: { params: Promise<{ shareId: string }> }) {
  const user = await fileUser(request); if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 }); const { shareId } = await params;
  const share = await prisma.fileShare.findUnique({ where: { id: shareId } }); if (!share) return NextResponse.json({ error: "分享不存在" }, { status: 404 }); if (!(await projectFileAccess(user.id, share.projectId)).canManage) return NextResponse.json({ error: "没有撤销分享的权限" }, { status: 403 });
  await prisma.fileShare.update({ where: { id: shareId }, data: { revokedAt: new Date() } }); return NextResponse.json({ ok: true });
}
