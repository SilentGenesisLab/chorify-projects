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
  if (target.role === "OWNER" || (actor.role === "ADMIN" && target.role === "ADMIN")) return { error: NextResponse.json({ error: "当前角色无权操作该成员" }, { status: 403 }) };
  return { userId, actor, target };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ teamId: string; memberId: string }> }) {
  const { teamId, memberId } = await params;
  const access = await context(request, teamId, memberId);
  if ("error" in access) return access.error;
  const input = z.object({ role: z.enum(["ADMIN", "MEMBER", "GUEST"]).optional(), title: z.string().trim().max(80).optional(), responsibility: z.string().trim().max(500).optional(), bio: z.string().trim().max(1000).optional() }).safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: "成员资料不符合要求" }, { status: 400 });
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
