import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUserId } from "@/lib/team-permissions";

const asRecord = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export async function GET(request: NextRequest) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const [memberships, managedTeams] = await Promise.all([
    prisma.projectMember.findMany({ where: { userId }, select: { projectId: true } }),
    prisma.teamMember.findMany({ where: { userId, role: { in: ["OWNER", "ADMIN"] } }, select: { teamId: true } }),
  ]);
  const managedProjects = managedTeams.length ? await prisma.project.findMany({ where: { teamId: { in: managedTeams.map((x) => x.teamId) } }, select: { id: true } }) : [];
  const projectIds = [...new Set([...memberships.map((x) => x.projectId), ...managedProjects.map((x) => x.id)])];

  // JSON metadata is intentionally filtered in application code for compatibility with existing deployments.
  const candidates = await prisma.auditLog.findMany({
    include: { user: { select: { id: true, name: true, phone: true } } },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  const visible = candidates.filter((log) => {
    if (log.userId === userId) return true;
    const metadata = asRecord(log.metadata);
    return typeof metadata.projectId === "string" && projectIds.includes(metadata.projectId);
  }).slice(0, 500);

  const tokenIds = [...new Set(visible.map((log) => asRecord(log.metadata).tokenId).filter((id): id is string => typeof id === "string"))];
  const referencedProjectIds = [...new Set(visible.flatMap((log) => {
    const metadata = asRecord(log.metadata);
    const id = typeof metadata.projectId === "string" ? metadata.projectId : log.resource === "PROJECT" ? log.resourceId : null;
    return id ? [id] : [];
  }))];
  const [tokens, projects] = await Promise.all([
    prisma.apiToken.findMany({ where: { id: { in: tokenIds } }, select: { id: true, name: true, prefix: true } }),
    prisma.project.findMany({ where: { id: { in: referencedProjectIds } }, select: { id: true, code: true, name: true } }),
  ]);
  const tokenMap = new Map(tokens.map((x) => [x.id, x]));
  const projectMap = new Map(projects.map((x) => [x.id, x]));

  return NextResponse.json({ logs: visible.map((log) => {
    const metadata = asRecord(log.metadata);
    const token = typeof metadata.tokenId === "string" ? tokenMap.get(metadata.tokenId) : undefined;
    const projectId = typeof metadata.projectId === "string" ? metadata.projectId : log.resource === "PROJECT" ? log.resourceId : null;
    return {
      id: log.id, actor: log.user ? { id: log.user.id, name: log.user.name, phone: log.user.phone } : null,
      action: log.action, resource: log.resource, resourceId: log.resourceId, channel: log.channel,
      token: token ?? (metadata.tokenPrefix ? { id: metadata.tokenId ?? "", name: metadata.tokenName ?? "API Key", prefix: metadata.tokenPrefix } : null),
      project: projectId ? projectMap.get(projectId) ?? null : null,
      result: typeof metadata.result === "string" ? metadata.result : "SUCCESS",
      metadata, createdAt: log.createdAt,
    };
  }), projects });
}
