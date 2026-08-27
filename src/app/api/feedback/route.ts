import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticatedUserId } from "@/lib/web-auth";

const TYPES = new Set(["PRODUCT", "BUG", "EXPERIENCE", "OTHER"]);
const MAX_FILES = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const userId = await authenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const form = await request.formData();
  const type = String(form.get("type") || "");
  const content = String(form.get("content") || "").trim();
  const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (!TYPES.has(type)) return NextResponse.json({ error: "请选择反馈类型" }, { status: 400 });
  if (content.length < 5 || content.length > 2000) return NextResponse.json({ error: "反馈内容需要 5—2000 个字符" }, { status: 400 });
  if (files.length > MAX_FILES) return NextResponse.json({ error: "最多上传 3 个附件" }, { status: 400 });
  if (files.some((file) => file.size > MAX_FILE_SIZE)) return NextResponse.json({ error: "单个附件不能超过 5MB" }, { status: 400 });
  const attachments = await Promise.all(files.map(async (file) => ({ name: file.name.slice(0, 200), mimeType: file.type || "application/octet-stream", size: file.size, data: Buffer.from(await file.arrayBuffer()) })));
  const feedback = await prisma.$transaction(async (tx) => {
    const created = await tx.feedback.create({ data: { userId, type, content, attachments: { create: attachments } } });
    await tx.auditLog.create({ data: { userId, actorType: "USER", action: "SUBMIT_FEEDBACK", resource: "FEEDBACK", resourceId: created.id, channel: "WEB", metadata: { type, attachmentCount: attachments.length } } });
    return created;
  });
  return NextResponse.json({ id: feedback.id, status: feedback.status }, { status: 201 });
}
