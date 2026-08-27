import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fileUser, jsonBigInt, storageUsage, STORAGE_LIMIT, STORAGE_UPLOAD_STOP, STORAGE_WARNING } from "@/lib/file-auth";

export async function GET(request: Request) {
  const user = await fileUser(request);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const url = new URL(request.url), projectId = url.searchParams.get("projectId"), folderId = url.searchParams.get("folderId"), trash = url.searchParams.get("trash") === "1";
  const access: Prisma.ProjectWhereInput = { OR: [{ members: { some: { userId: user.id } } }, { team: { members: { some: { userId: user.id, role: { in: ["OWNER", "ADMIN"] } } } } }] };
  const projects = await prisma.project.findMany({ where: access, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } });
  const allowed = new Set(projects.map((project) => project.id));
  if (projectId && !allowed.has(projectId)) return NextResponse.json({ error: "没有项目文件访问权限" }, { status: 403 });
  const projectIds = projectId ? [projectId] : [...allowed];
  const deletedAt = trash ? { not: null as Date | null } : null;
  const [folders, treeFolders, files, usage] = await Promise.all([
    prisma.fileFolder.findMany({ where: { projectId: { in: projectIds }, parentId: folderId || null, deletedAt }, include: { project: { select: { name: true } }, creator: { select: { name: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.fileFolder.findMany({ where: { projectId: { in: projectIds }, deletedAt: null }, select: { id: true, projectId: true, parentId: true, name: true, path: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.fileAsset.findMany({ where: { projectId: { in: projectIds }, folderId: folderId || null, deletedAt }, include: { project: { select: { name: true } }, creator: { select: { name: true } }, currentVersion: true, _count: { select: { versions: true, links: true } } }, orderBy: { updatedAt: "desc" } }),
    storageUsage(),
  ]);
  return NextResponse.json({ projects, folders, treeFolders, files: files.map((file) => ({ ...file, size: jsonBigInt(file.size), currentVersion: file.currentVersion ? { ...file.currentVersion, size: jsonBigInt(file.currentVersion.size) } : null })), storage: { used: jsonBigInt(usage), limit: jsonBigInt(STORAGE_LIMIT), warning: usage >= STORAGE_WARNING, blocked: usage >= STORAGE_UPLOAD_STOP } });
}
