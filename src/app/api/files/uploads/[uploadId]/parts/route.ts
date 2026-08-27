import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fileUser } from "@/lib/file-auth";
import { signPart } from "@/lib/object-storage";

export async function POST(request: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const user = await fileUser(request, "file:create"); if (!user) return NextResponse.json({ error: "请先登录或提供有效 API Key" }, { status: 401 });
  const { uploadId } = await params, input = z.object({ partNumbers: z.array(z.number().int().min(1).max(10000)).min(1).max(100) }).safeParse(await request.json()); if (!input.success) return NextResponse.json({ error: "分片编号无效" }, { status: 400 });
  const upload = await prisma.fileUploadSession.findFirst({ where: { id: uploadId, userId: user.id, status: "PENDING", expiresAt: { gt: new Date() } } }); if (!upload) return NextResponse.json({ error: "上传会话不存在或已过期" }, { status: 404 });
  const parts = await Promise.all(input.data.partNumbers.map(async (partNumber) => ({ partNumber, url: await signPart(upload.objectKey, upload.multipartId, partNumber) })));
  return NextResponse.json({ parts });
}
