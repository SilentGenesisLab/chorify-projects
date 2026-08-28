import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUserId, maskedPhone } from "@/lib/team-permissions";
import { verifyAndConsumeSmsCode } from "@/lib/sms-code";

export async function POST(request: NextRequest) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const input = z.object({ phone: z.string().regex(/^1\d{10}$/, "请输入正确的手机号"), code: z.string().regex(/^\d{6}$/, "请输入 6 位验证码") }).safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message }, { status: 400 });
  const occupied = await prisma.user.findFirst({ where: { phone: input.data.phone, id: { not: userId } }, select: { id: true } });
  if (occupied) return NextResponse.json({ error: "该手机号已绑定其他账户" }, { status: 409 });
  if (!await verifyAndConsumeSmsCode(input.data.phone, input.data.code)) return NextResponse.json({ error: "验证码无效或已过期" }, { status: 401 });
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { phone: input.data.phone } }),
    prisma.auditLog.create({ data: { userId, actorType: "USER", action: "CHANGE_PHONE", resource: "USER", resourceId: userId, channel: "WEB", metadata: { newPhone: maskedPhone(input.data.phone) } } }),
  ]);
  return NextResponse.json({ ok: true, maskedPhone: maskedPhone(input.data.phone) });
}
