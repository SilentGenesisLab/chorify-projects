import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fileScopeAccess, fileUser } from "@/lib/file-auth";

const inputSchema = z.object({ projectId: z.string().min(1).nullable(), parentId: z.string().nullable().optional(), name: z.string().trim().min(1).max(120).refine((name) => !/[\\/:*?"<>|]/.test(name), "文件夹名称包含非法字符") });
export async function POST(request: Request) {
  const user = await fileUser(request); if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const input = inputSchema.safeParse(await request.json()); if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message }, { status: 400 });
  const permission = await fileScopeAccess(user.id, input.data.projectId); if (!permission.canWrite) return NextResponse.json({ error: "没有创建文件夹的权限" }, { status: 403 });
  let parentPath = "", depth = 0;
  if (input.data.parentId) { const parent = await prisma.fileFolder.findFirst({ where: { id: input.data.parentId, projectId: input.data.projectId, deletedAt: null } }); if (!parent) return NextResponse.json({ error: "上级文件夹不存在" }, { status: 404 }); parentPath = parent.path; depth = parent.path.split("/").filter(Boolean).length; }
  if (depth >= 20) return NextResponse.json({ error: "目录层级不能超过 20 层" }, { status: 400 });
  const duplicate = await prisma.fileFolder.findFirst({ where: { projectId: input.data.projectId, parentId: input.data.parentId || null, name: input.data.name, deletedAt: null } }); if (duplicate) return NextResponse.json({ error: "同级已有同名文件夹" }, { status: 409 });
  const folder = await prisma.fileFolder.create({ data: { projectId: input.data.projectId, parentId: input.data.parentId || null, name: input.data.name, path: `${parentPath}/${input.data.name}`, creatorId: user.id } });
  await prisma.auditLog.create({ data: { userId: user.id, actorType: "USER", action: "CREATE_FOLDER", resource: "FILE_FOLDER", resourceId: folder.id, channel: "WEB", metadata: { projectId: folder.projectId } } });
  return NextResponse.json({ folder }, { status: 201 });
}
