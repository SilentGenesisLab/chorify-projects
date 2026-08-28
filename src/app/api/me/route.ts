import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUserId, maskedPhone } from "@/lib/team-permissions";

const avatar = z.string().max(700_000).refine(
  value => /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value),
  "头像格式无效",
).nullable().optional();

export async function GET(request: NextRequest) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, phone: true, avatarColor: true, avatarUrl: true } });
  if (!user) return NextResponse.json({ error: "账户不存在" }, { status: 404 });
  return NextResponse.json({ user: { ...user, maskedPhone: maskedPhone(user.phone) } });
}

export async function PATCH(request: NextRequest) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const input = z.object({ name: z.string().trim().min(2, "账户名至少 2 个字符").max(40), avatarUrl: avatar }).safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message || "资料格式错误" }, { status: 400 });
  const user = await prisma.$transaction(async tx => {
    const updated = await tx.user.update({ where: { id: userId }, data: input.data, select: { name: true, phone: true, avatarColor: true, avatarUrl: true } });
    await tx.auditLog.create({ data: { userId, actorType: "USER", action: "UPDATE_PROFILE", resource: "USER", resourceId: userId, channel: "WEB", metadata: { avatarChanged: input.data.avatarUrl !== undefined } } });
    return updated;
  });
  return NextResponse.json({ user: { ...user, maskedPhone: maskedPhone(user.phone) } });
}
