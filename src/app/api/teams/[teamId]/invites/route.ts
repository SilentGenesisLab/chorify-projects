import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createTeamInviteToken, encryptTeamInviteToken } from "@/lib/security";
import { getRequestUserId, getTeamMembership, isRateLimited, TEAM_ROLE_LABELS } from "@/lib/team-permissions";

export async function POST(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { teamId } = await params;
  const membership = await getTeamMembership(teamId, userId);
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) return NextResponse.json({ error: "没有邀请成员的权限" }, { status: 403 });
  const input = z.object({ role: z.enum(["ADMIN", "MEMBER", "GUEST"]), maxUses: z.number().int().min(1).max(50) }).safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: "请选择有效角色和 1–50 人的人数上限" }, { status: 400 });
  if (input.data.role === "ADMIN" && membership.role !== "OWNER") return NextResponse.json({ error: "只有团队所有者可以邀请管理员" }, { status: 403 });
  if (await isRateLimited(userId, "CREATE_TEAM_INVITE", 8)) return NextResponse.json({ error: "邀请创建过于频繁，请稍后再试" }, { status: 429 });
  const token = createTeamInviteToken();
  const invite = await prisma.$transaction(async (tx) => {
    const created = await tx.teamInvite.create({ data: { teamId, createdById: userId, role: input.data.role, maxUses: input.data.maxUses, expiresAt: new Date(Date.now() + 7 * 86_400_000), prefix: token.prefix, tokenHash: token.tokenHash, tokenCiphertext: encryptTeamInviteToken(token.token) } });
    await tx.auditLog.create({ data: { userId, actorType: "USER", action: "CREATE_TEAM_INVITE", resource: "TEAM_INVITE", resourceId: created.id, channel: "WEB", metadata: { teamId, role: created.role, maxUses: created.maxUses } } });
    return created;
  });
  return NextResponse.json({ invite: { id: invite.id, token: token.token, url: `${request.nextUrl.origin}/invite/${token.token}`, prefix: invite.prefix, role: invite.role, roleLabel: TEAM_ROLE_LABELS[invite.role], maxUses: invite.maxUses, useCount: 0, expiresAt: invite.expiresAt } }, { status: 201 });
}
