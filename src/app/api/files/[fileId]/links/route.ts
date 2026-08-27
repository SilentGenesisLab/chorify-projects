import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiTokenAllowsProject, fileUser, projectFileAccess } from "@/lib/file-auth";

export async function POST(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const user = await fileUser(request, "file:update"); if (!user) return NextResponse.json({ error: "请先登录或提供有效 API Key" }, { status: 401 }); const { fileId } = await params;
  const input = z.object({ resourceType: z.enum(["TASK", "REQUIREMENT", "BUG", "VERSION", "RELEASE"]), resourceId: z.string().min(1) }).safeParse(await request.json()); if (!input.success) return NextResponse.json({ error: "引用信息无效" }, { status: 400 });
  const file = await prisma.fileAsset.findUnique({ where: { id: fileId } }); if (!file || !apiTokenAllowsProject(user, file.projectId) || !(await projectFileAccess(user.id, file.projectId)).canWrite) return NextResponse.json({ error: "没有引用文件的权限" }, { status: 403 });
  const existing = await prisma.resourceLink.findFirst({ where: { fileId, resourceType: input.data.resourceType, resourceId: input.data.resourceId } }); const link = existing || await prisma.resourceLink.create({ data: { fileId, ...input.data } }); return NextResponse.json({ link }, { status: existing ? 200 : 201 });
}
