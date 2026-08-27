import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendSmsCode } from "@/lib/sms";

export async function POST(request: Request) {
  const parsed = z.object({ phone: z.string().regex(/^1\d{10}$/) }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "请输入正确的手机号" }, { status: 400 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [recentPhone, phoneCount, ipCount] = await Promise.all([
    prisma.smsCode.findFirst({ where: { phone: parsed.data.phone }, orderBy: { createdAt: "desc" } }),
    prisma.smsCode.count({ where: { phone: parsed.data.phone, createdAt: { gte: since } } }),
    prisma.smsCode.count({ where: { ip, createdAt: { gte: since } } }),
  ]);
  if (recentPhone && Date.now() - recentPhone.createdAt.getTime() < 60_000) return NextResponse.json({ error: "请在 60 秒后重试" }, { status: 429 });
  if (phoneCount >= 5 || ipCount >= 20) return NextResponse.json({ error: "发送次数过多，请稍后重试" }, { status: 429 });
  const code = randomInt(100000, 999999).toString();
  await sendSmsCode(parsed.data.phone, code);
  await prisma.smsCode.create({ data: { phone: parsed.data.phone, codeHash: await hash(code, 10), ip, expiresAt: new Date(Date.now() + 5 * 60_000) } });
  return NextResponse.json({ ok: true, expiresIn: 300 });
}
