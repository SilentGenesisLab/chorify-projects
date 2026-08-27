import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSessionToken, sessionCookie } from "@/lib/session";

const schema = z.object({
  name: z.string().trim().min(2, "姓名至少 2 个字").max(30),
  phone: z.string().regex(/^1\d{10}$/, "手机号格式不正确"),
  code: z.string().regex(/^\d{6}$/, "请输入 6 位验证码"),
  password: z.string().min(8, "密码至少 8 位").max(72).regex(/[A-Za-z]/, "密码必须包含字母").regex(/\d/, "密码必须包含数字"),
});

export async function POST(request: Request) {
  const input = schema.safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message || "注册信息不完整" }, { status: 400 });
  if (await prisma.user.findUnique({ where: { phone: input.data.phone } })) return NextResponse.json({ error: "该手机号已经注册，请直接登录" }, { status: 409 });
  const record = await prisma.smsCode.findFirst({ where: { phone: input.data.phone, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!record || !await compare(input.data.code, record.codeHash)) return NextResponse.json({ error: "验证码无效或已过期" }, { status: 401 });
  const passwordHash = await hash(input.data.password, 12);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { name: input.data.name, phone: input.data.phone, passwordHash } });
    await tx.smsCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    await tx.auditLog.create({ data: { userId: created.id, actorType: "USER", action: "REGISTER", resource: "USER", resourceId: created.id, channel: "WEB" } });
    return created;
  });
  const response = NextResponse.json({ user: { id: user.id, name: user.name } }, { status: 201 });
  response.headers.set("Set-Cookie", sessionCookie(await createSessionToken(user.id)));
  return response;
}
