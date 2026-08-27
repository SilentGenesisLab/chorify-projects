import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/security";

export async function authenticateApi(request: Request, requireWork = false) {
  const raw = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!raw?.startsWith("chp_")) return null;
  const token = await prisma.apiToken.findUnique({
    where: { tokenHash: sha256(raw) },
    include: { user: true },
  });
  if (!token || token.revokedAt || (token.expiresAt && token.expiresAt <= new Date())) return null;
  if (requireWork && token.mode !== "WORK") return null;
  await prisma.apiToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } });
  return token;
}
