import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUserId, isRateLimited, TEAM_ROLE_LABELS } from "@/lib/team-permissions";

export async function GET(request: NextRequest) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const memberships = await prisma.teamMember.findMany({
    where: { userId }, orderBy: { joinedAt: "desc" },
    include: { team: { include: { _count: { select: { members: true, projects: true } } } } },
  });
  return NextResponse.json({ teams: memberships.map(({ role, joinedAt, team }) => ({
    id: team.id, name: team.name, description: team.description, role, roleLabel: TEAM_ROLE_LABELS[role],
    memberCount: team._count.members, projectCount: team._count.projects, joinedAt,
  })) });
}

export async function POST(request: NextRequest) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (await isRateLimited(userId, "CREATE_TEAM", 5)) return NextResponse.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
  const input = z.object({ name: z.string().trim().min(2).max(40), description: z.string().trim().max(200).optional() }).safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: "团队名称需要 2–40 个字符" }, { status: 400 });
  const team = await prisma.$transaction(async (tx) => {
    const created = await tx.team.create({ data: { name: input.data.name, description: input.data.description || null,
      members: { create: { userId, role: "OWNER" } } } });
    await tx.auditLog.create({ data: { userId, actorType: "USER", action: "CREATE_TEAM", resource: "TEAM", resourceId: created.id, channel: "WEB", metadata: { name: created.name } } });
    return created;
  });
  return NextResponse.json({ team }, { status: 201 });
}
