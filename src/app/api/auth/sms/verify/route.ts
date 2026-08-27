import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSessionToken, sessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  const input = z.object({ phone: z.string().regex(/^1\d{10}$/), code: z.string().regex(/^\d{6}$/) }).safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: "手机号或验证码格式错误" }, { status: 400 });
  const record = await prisma.smsCode.findFirst({ where: { phone: input.data.phone, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!record || !await compare(input.data.code, record.codeHash)) return NextResponse.json({ error: "验证码无效或已过期" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { phone: input.data.phone } });
  if (!user) return NextResponse.json({ error: "该手机号尚未开通账户" }, { status: 404 });
  await prisma.smsCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  const response = NextResponse.json({ user: { id: user.id, name: user.name } });
  response.headers.set("Set-Cookie", sessionCookie(await createSessionToken(user.id)));
  return response;
}
