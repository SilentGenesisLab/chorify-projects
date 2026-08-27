import { prisma } from "@/lib/prisma";
import { authenticatedUserId } from "@/lib/web-auth";

export const MAX_FILE_SIZE = BigInt(2 * 1024 * 1024 * 1024);
export const STORAGE_LIMIT = BigInt(10 * 1024 * 1024 * 1024);
export const STORAGE_WARNING = BigInt(8 * 1024 * 1024 * 1024);
export const STORAGE_UPLOAD_STOP = BigInt(Math.floor(9.5 * 1024 * 1024 * 1024));

export async function fileUser(request: Request) {
  const userId = await authenticatedUserId(request);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, systemRole: true } });
  return user;
}

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

export function jsonBigInt(value: bigint) { return Number(value); }
export function folderMoveCreatesCycle(folderId: string, folderPath: string, parent: { id: string; path: string } | null) { return Boolean(parent && (parent.id === folderId || parent.path.startsWith(`${folderPath}/`))); }
export function uploadFitsQuota(used: bigint, incoming: bigint) { return incoming > BigInt(0) && incoming <= MAX_FILE_SIZE && used + incoming <= STORAGE_UPLOAD_STOP; }
