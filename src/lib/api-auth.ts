import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/security";
import { hasApiPermission, type ApiTokenPermission } from "@/lib/api-token-permissions";
import { getProjectAccess } from "@/lib/project-permissions";

export async function authenticateApiIdentity(request: Request) {
  const raw = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!raw?.startsWith("chp_")) return null;
  const token = await prisma.apiToken.findUnique({
    where: { tokenHash: sha256(raw) },
    include: { user: true },
  });
  if (!token || token.revokedAt || (token.expiresAt && token.expiresAt <= new Date())) return null;
  await prisma.apiToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } });
  return token;
}

export type ApiPrincipal = NonNullable<Awaited<ReturnType<typeof authenticateApiIdentity>>>;

export async function authenticateApi(request: Request, permission: ApiTokenPermission) {
  const auth = await authenticateApiIdentity(request);
  return auth && hasApiPermission(auth.permissions, permission) ? auth : null;
}

export async function tokenCanAccessProject(auth: ApiPrincipal, projectId: string) {
  return Boolean((await getProjectAccess(projectId, auth.userId))?.canAccess);
}

export async function tokenCanAccessTeam(auth: ApiPrincipal, teamId: string, manager = false) {
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: auth.userId } },
    select: { role: true },
  });
  if (!membership) return false;
  return !manager || membership.role === "OWNER" || membership.role === "ADMIN";
}
