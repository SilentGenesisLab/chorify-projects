import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function verifyAndConsumeSmsCode(phone: string, code: string) {
  const record = await prisma.smsCode.findFirst({
    where: { phone, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!record || !(await compare(code, record.codeHash))) return false;
  const result = await prisma.smsCode.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return result.count === 1;
}
