import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSessionToken, sessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  const input = z.object({ phone: z.string().regex(/^1\d{10}$/), password: z.string().min(8) }).safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: "手机号或密码格式不正确" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { phone: input.data.phone } });
  if (!user || !await compare(input.data.password, user.passwordHash)) return NextResponse.json({ error: "手机号或密码错误" }, { status: 401 });
  const response = NextResponse.json({ user: { id: user.id, name: user.name } });
  response.headers.set("Set-Cookie", sessionCookie(await createSessionToken(user.id)));
  return response;
}
