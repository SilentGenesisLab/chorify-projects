export const MAX_FILE_SIZE = BigInt(2 * 1024 * 1024 * 1024);
export const STORAGE_LIMIT = BigInt(10 * 1024 * 1024 * 1024);
export const STORAGE_WARNING = BigInt(8 * 1024 * 1024 * 1024);
export const STORAGE_UPLOAD_STOP = BigInt(Math.floor(9.5 * 1024 * 1024 * 1024));
export function folderMoveCreatesCycle(folderId: string, folderPath: string, parent: { id: string; path: string } | null) { return Boolean(parent && (parent.id === folderId || parent.path.startsWith(`${folderPath}/`))); }
export function uploadFitsQuota(used: bigint, incoming: bigint) { return incoming > BigInt(0) && incoming <= MAX_FILE_SIZE && used + incoming <= STORAGE_UPLOAD_STOP; }
