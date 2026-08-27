import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createPersonalToken } from "@/lib/security";

// Prototype endpoint: X-Demo-User identifies the signed-in user until the web session layer is wired.
export async function POST(request: Request) {
  const userId = request.headers.get("x-demo-user");
  if (!userId) return NextResponse.json({ error: "缺少用户会话" }, { status: 401 });
  const input = z.object({ name: z.string().min(2), projectId: z.string().optional(), mode: z.enum(["READ", "WORK"]), expiresAt: z.string().datetime().optional() }).safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: "参数不正确" }, { status: 400 });
  if (input.data.projectId && !await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: input.data.projectId, userId } } })) return NextResponse.json({ error: "无权授权该项目" }, { status: 403 });
  const generated = createPersonalToken();
  const record = await prisma.apiToken.create({ data: { userId, name: input.data.name, projectId: input.data.projectId, mode: input.data.mode, expiresAt: input.data.expiresAt ? new Date(input.data.expiresAt) : null, prefix: generated.prefix, tokenHash: generated.tokenHash } });
  return NextResponse.json({ id: record.id, token: generated.token, prefix: record.prefix }, { status: 201 });
}
