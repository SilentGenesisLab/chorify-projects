import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canCreateTeamProject, getRequestUserId, isRateLimited } from "@/lib/team-permissions";
import { getProjectAccess } from "@/lib/project-permissions";

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { projectId } = await params;
  const input = z.object({ teamId: z.string().min(1) }).safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: "请选择目标团队" }, { status: 400 });
  const access = await getProjectAccess(projectId, userId);
  if (!access?.projectMember || access.projectMember.role !== "OWNER") {
    return NextResponse.json({ error: "只有项目所有者可以转入团队" }, { status: 403 });
  }
  if (access.project.teamId) return NextResponse.json({ error: "团队项目不能转回个人或转移到其他团队" }, { status: 409 });
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: input.data.teamId, userId } },
  });
  if (!membership || !canCreateTeamProject(membership.role)) {
    return NextResponse.json({ error: "只能转入你作为正式成员加入的团队" }, { status: 403 });
  }
  if (await isRateLimited(userId, "TRANSFER_PROJECT", 5)) return NextResponse.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
  const project = await prisma.$transaction(async (tx) => {
    const updated = await tx.project.update({
      where: { id: projectId },
      data: { teamId: input.data.teamId },
    });
    await tx.auditLog.create({
      data: {
        userId,
        actorType: "USER",
        action: "TRANSFER_PROJECT_TO_TEAM",
        resource: "PROJECT",
        resourceId: projectId,
        channel: "WEB",
        metadata: {
          fromScope: "PERSONAL",
          toScope: "TEAM",
          teamId: input.data.teamId,
        },
      },
    });
    return updated;
  });
  return NextResponse.json({ project });
}
