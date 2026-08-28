import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSessionToken, sessionCookie } from "@/lib/session";
import { verifyAndConsumeSmsCode } from "@/lib/sms-code";

export async function POST(request: Request) {
  const input = z.object({ phone: z.string().regex(/^1\d{10}$/), code: z.string().regex(/^\d{6}$/) }).safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: "手机号或验证码格式错误" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { phone: input.data.phone } });
  if (!user) return NextResponse.json({ error: "该手机号尚未开通账户" }, { status: 404 });
  if (!await verifyAndConsumeSmsCode(input.data.phone, input.data.code)) return NextResponse.json({ error: "验证码无效或已过期" }, { status: 401 });
  const response = NextResponse.json({ user: { id: user.id, name: user.name } });
  response.headers.set("Set-Cookie", sessionCookie(await createSessionToken(user.id)));
  return response;
}
