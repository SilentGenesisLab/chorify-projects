import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/security";
import type { ApiTokenPermission } from "@/lib/api-token-permissions";

export async function authenticateApi(request: Request, permission: ApiTokenPermission) {
  const raw = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!raw?.startsWith("chp_")) return null;
  const token = await prisma.apiToken.findUnique({
    where: { tokenHash: sha256(raw) },
    include: { user: true, projects: { select: { projectId: true } } },
  });
  if (!token || token.revokedAt || (token.expiresAt && token.expiresAt <= new Date())) return null;
  if (!token.permissions.includes(permission)) return null;
  await prisma.apiToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } });
  return token;
}

export async function tokenCanAccessProject(auth: NonNullable<Awaited<ReturnType<typeof authenticateApi>>>, projectId: string) {
  if (!auth.allProjects && !auth.projects.some((project) => project.projectId === projectId)) return false;
  return Boolean(await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: auth.userId } }, select: { id: true } }));
}
