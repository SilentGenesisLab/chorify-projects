import { hash } from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUserId } from "@/lib/team-permissions";
import { verifyAndConsumeSmsCode } from "@/lib/sms-code";

export async function POST(request: NextRequest) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const input = z.object({ code: z.string().regex(/^\d{6}$/, "请输入 6 位验证码"), password: z.string().min(8, "密码至少 8 位").max(72).regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, "密码需包含字母和数字") }).safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
  if (!user) return NextResponse.json({ error: "账户不存在" }, { status: 404 });
  if (!await verifyAndConsumeSmsCode(user.phone, input.data.code)) return NextResponse.json({ error: "验证码无效或已过期" }, { status: 401 });
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await hash(input.data.password, 12) } }),
    prisma.auditLog.create({ data: { userId, actorType: "USER", action: "CHANGE_PASSWORD", resource: "USER", resourceId: userId, channel: "WEB" } }),
  ]);
  return NextResponse.json({ ok: true });
}
