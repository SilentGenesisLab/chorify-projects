import { prisma } from "@/lib/prisma";
import { authenticatedUserId } from "@/lib/web-auth";
import { statfs } from "node:fs/promises";
import { authenticateApi } from "@/lib/api-auth";
import type { ApiTokenPermission } from "@/lib/api-token-permissions";

export { MAX_FILE_SIZE, STORAGE_LIMIT, STORAGE_WARNING, STORAGE_UPLOAD_STOP, folderMoveCreatesCycle, uploadFitsQuota } from "@/lib/file-rules";

export async function fileUser(request: Request, apiPermission?: ApiTokenPermission) {
  const userId = await authenticatedUserId(request);
  if (userId) { const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, systemRole: true } }); return user ? { ...user, apiToken: null } : null; }
  if (!apiPermission) return null;
  const auth = await authenticateApi(request, apiPermission);
  return auth ? { id: auth.userId, systemRole: auth.user.systemRole, apiToken: auth } : null;
}
export function apiTokenAllowsProject(user: NonNullable<Awaited<ReturnType<typeof fileUser>>>, projectId: string) { return !user.apiToken || user.apiToken.allProjects || user.apiToken.projects.some((scope) => scope.projectId === projectId); }

export async function projectFileAccess(userId: string, projectId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } });
  const member = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } }, select: { role: true } });
  const teamAdmin = await prisma.teamMember.findFirst({ where: { userId, team: { projects: { some: { id: projectId } } }, role: { in: ["OWNER", "ADMIN"] } }, select: { id: true } });
  const canManage = user?.systemRole === "ADMIN" || member?.role === "OWNER" || member?.role === "MANAGER" || Boolean(teamAdmin);
  return { canRead: canManage || Boolean(member), canWrite: canManage || member?.role === "MEMBER", canManage };
}

export async function storageUsage() {
  const aggregate = await prisma.fileVersion.aggregate({ _sum: { size: true }, where: { file: { deletedAt: null } } });
  return aggregate._sum.size || BigInt(0);
}
export async function hostDiskAllowsUpload() { const path = process.env.STORAGE_CAPACITY_PATH; if (!path) return true; try { const stats = await statfs(path, { bigint: true }); return stats.bavail * stats.bsize >= BigInt(10 * 1024 * 1024 * 1024); } catch { return false; } }

export function jsonBigInt(value: bigint) { return Number(value); }
