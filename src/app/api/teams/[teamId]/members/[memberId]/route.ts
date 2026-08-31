import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUserId, getTeamMembership, isRateLimited } from "@/lib/team-permissions";

async function context(request: NextRequest, teamId: string, memberId: string) {
  const userId = await getRequestUserId(request);
  if (!userId) return { error: NextResponse.json({ error: "请先登录" }, { status: 401 }) };
  const [actor, target] = await Promise.all([
    getTeamMembership(teamId, userId),
    prisma.teamMember.findFirst({ where: { id: memberId, teamId } }),
  ]);
  if (!actor || !target) return { error: NextResponse.json({ error: "成员不存在或无权操作" }, { status: 404 }) };
  if (actor.role !== "OWNER" && actor.role !== "ADMIN") return { error: NextResponse.json({ error: "没有团队管理权限" }, { status: 403 }) };
  if ((target.role === "OWNER" && actor.role !== "OWNER") || (actor.role === "ADMIN" && target.role === "ADMIN")) return { error: NextResponse.json({ error: "当前角色无权操作该成员" }, { status: 403 }) };
  return { userId, actor, target };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ teamId: string; memberId: string }> }) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { teamId, memberId } = await params;
  const viewer = await getTeamMembership(teamId, userId);
  if (!viewer) return NextResponse.json({ error: "你不是该团队成员" }, { status: 403 });
  const member = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId },
    include: { user: { select: { id: true, name: true, phone: true, avatarColor: true } } },
  });
  if (!member) return NextResponse.json({ error: "成员不存在" }, { status: 404 });
  const objectives = await prisma.teamObjective.findMany({
    where: {
      teamId,
      OR: [
        { ownerId: member.userId },
        { keyResults: { some: { OR: [{ ownerId: member.userId }, { alignments: { some: { userId: member.userId } } }] } } },
      ],
    },
    include: {
      owner: { select: { id: true, name: true } },
      keyResults: {
        where: { OR: [{ ownerId: member.userId }, { alignments: { some: { userId: member.userId } } }] },
        include: { owner: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ member: {
    id: member.id,
    userId: member.userId,
    accountName: member.user.name,
    name: member.displayName || member.user.name,
    displayName: member.displayName,
    phone: member.user.phone.replace(/^(\d{3})\d+(\d{4})$/, "$1****$2"),
    avatarColor: member.user.avatarColor,
    role: member.role,
    joinedAt: member.joinedAt,
    title: member.title,
    responsibility: member.responsibility,
    bio: member.bio,
    objectives,
  } });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ teamId: string; memberId: string }> }) {
  const { teamId, memberId } = await params;
  const access = await context(request, teamId, memberId);
  if ("error" in access) return access.error;
  const input = z.object({ role: z.enum(["ADMIN", "MEMBER", "GUEST"]).optional(), displayName: z.string().trim().max(50).nullable().optional(), title: z.string().trim().max(80).nullable().optional(), responsibility: z.string().trim().max(500).nullable().optional(), bio: z.string().trim().max(1000).nullable().optional() }).safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: "成员资料不符合要求" }, { status: 400 });
  if (access.target.role === "OWNER" && input.data.role) return NextResponse.json({ error: "不能通过成员资料修改所有者角色" }, { status: 403 });
  if (input.data.role === "ADMIN" && access.actor.role !== "OWNER") return NextResponse.json({ error: "只有团队所有者可以设置管理员" }, { status: 403 });
  if (await isRateLimited(access.userId, "UPDATE_TEAM_ROLE")) return NextResponse.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
  const member = await prisma.$transaction(async (tx) => {
    const updated = await tx.teamMember.update({ where: { id: memberId }, data: input.data });
    await tx.auditLog.create({ data: { userId: access.userId, actorType: "USER", action: input.data.role ? "UPDATE_TEAM_ROLE" : "UPDATE_TEAM_MEMBER_PROFILE", resource: "TEAM_MEMBER", resourceId: memberId, channel: "WEB", metadata: { teamId, targetUserId: access.target.userId, fields: Object.keys(input.data) } } });
    return updated;
  });
  return NextResponse.json({ member });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ teamId: string; memberId: string }> }) {
  const { teamId, memberId } = await params;
  const access = await context(request, teamId, memberId);
  if ("error" in access) return access.error;
  if (await isRateLimited(access.userId, "REMOVE_TEAM_MEMBER")) return NextResponse.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
  await prisma.$transaction(async (tx) => {
    await tx.teamMember.delete({ where: { id: memberId } });
    await tx.auditLog.create({ data: { userId: access.userId, actorType: "USER", action: "REMOVE_TEAM_MEMBER", resource: "TEAM_MEMBER", resourceId: memberId, channel: "WEB", metadata: { teamId, removedUserId: access.target.userId } } });
  });
  return NextResponse.json({ ok: true });
}
