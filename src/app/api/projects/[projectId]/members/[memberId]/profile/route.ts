import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getProjectAccess, PROJECT_ROLE_LABELS } from "@/lib/project-permissions";
import { getRequestUserId, maskedPhone } from "@/lib/team-permissions";

const avatar = z.string().max(700_000).refine(
  (value) => /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value),
  "头像格式无效",
).nullable().optional();

const profileInput = z.object({
  displayName: z.string().trim().min(2).max(40).nullable().optional(),
  title: z.string().trim().max(80).nullable().optional(),
  responsibility: z.string().trim().max(500).nullable().optional(),
  bio: z.string().trim().max(1000).nullable().optional(),
  avatarUrl: avatar,
});

async function context(request: NextRequest, projectId: string, memberId: string) {
  const viewerId = await getRequestUserId(request);
  if (!viewerId) return { error: NextResponse.json({ error: "请先登录" }, { status: 401 }) };
  const [access, member] = await Promise.all([
    getProjectAccess(projectId, viewerId),
    prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
      include: {
        user: { select: { id: true, name: true, phone: true, avatarColor: true, avatarUrl: true } },
        project: { select: { id: true, name: true, teamId: true, team: { select: { id: true, name: true } } } },
      },
    }),
  ]);
  if (!access?.canAccess || !member) return { error: NextResponse.json({ error: "成员不存在或无权访问" }, { status: 403 }) };
  const teamProfile = member.project.teamId
    ? await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: member.project.teamId, userId: member.userId } },
        select: { displayName: true, title: true, responsibility: true, bio: true },
      })
    : null;
  return { viewerId, access, member, teamProfile };
}

function serialize(data: Exclude<Awaited<ReturnType<typeof context>>, { error: NextResponse }>) {
  const { viewerId, access, member, teamProfile } = data;
  return {
    member: {
      id: member.id,
      userId: member.userId,
      displayName: member.displayName || teamProfile?.displayName || member.user.name,
      projectDisplayName: member.displayName,
      title: member.title || teamProfile?.title || null,
      projectTitle: member.title,
      responsibility: member.responsibility || teamProfile?.responsibility || null,
      projectResponsibility: member.responsibility,
      bio: member.bio || teamProfile?.bio || null,
      projectBio: member.bio,
      avatarUrl: member.avatarUrl || member.user.avatarUrl,
      projectAvatarUrl: member.avatarUrl,
      avatarColor: member.user.avatarColor,
      phone: maskedPhone(member.user.phone),
      role: member.role,
      roleLabel: PROJECT_ROLE_LABELS[member.role],
    },
    project: member.project,
    permissions: {
      canEdit: Boolean(access.canManage || (viewerId === member.userId && member.role !== "GUEST")),
      canViewDetails: Boolean(access.canManage || viewerId === member.userId),
      isSelf: viewerId === member.userId,
    },
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string; memberId: string }> }) {
  const { projectId, memberId } = await params;
  const found = await context(request, projectId, memberId);
  if ("error" in found) return found.error;
  return NextResponse.json(serialize(found));
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ projectId: string; memberId: string }> }) {
  const { projectId, memberId } = await params;
  const found = await context(request, projectId, memberId);
  if ("error" in found) return found.error;
  if (!(found.access.canManage || (found.viewerId === found.member.userId && found.member.role !== "GUEST"))) {
    return NextResponse.json({ error: "没有编辑该项目成员档案的权限" }, { status: 403 });
  }
  const input = profileInput.safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message || "档案格式不正确" }, { status: 400 });
  await prisma.$transaction(async (tx) => {
    await tx.projectMember.update({ where: { id: memberId }, data: input.data });
    await tx.auditLog.create({
      data: {
        userId: found.viewerId,
        projectId,
        actorType: "USER",
        action: "UPDATE_PROJECT_MEMBER_PROFILE",
        resource: "PROJECT_MEMBER",
        resourceId: memberId,
        channel: "WEB",
        metadata: { targetUserId: found.member.userId, fields: Object.keys(input.data) },
      },
    });
  });
  const refreshed = await context(request, projectId, memberId);
  if ("error" in refreshed) return refreshed.error;
  return NextResponse.json(serialize(refreshed));
}
