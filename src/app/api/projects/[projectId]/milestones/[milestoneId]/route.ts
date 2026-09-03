import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUserId } from "@/lib/team-permissions";
import { getProjectAccess } from "@/lib/project-permissions";
import { milestoneSchema, validateMilestoneRelations } from "@/lib/milestone";

type Context = { params: Promise<{ projectId: string; milestoneId: string }> };

async function manager(request: NextRequest, projectId: string) {
  const userId = await getRequestUserId(request);
  if (!userId) return { error: "请先登录", status: 401 } as const;
  const access = await getProjectAccess(projectId, userId);
  if (!access?.canManage)
    return { error: "只有项目经理或所有者可以维护里程碑", status: 403 } as const;
  return { userId } as const;
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const { projectId, milestoneId } = await params;
  const auth = await manager(request, projectId);
  if ("error" in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = milestoneSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "里程碑信息不完整" },
      { status: 400 },
    );
  const existing = await prisma.milestone.findFirst({
    where: { id: milestoneId, projectId },
    select: { id: true, completedAt: true },
  });
  if (!existing) return NextResponse.json({ error: "里程碑不存在" }, { status: 404 });
  const relationError = await validateMilestoneRelations(
    projectId,
    parsed.data.ownerId,
    parsed.data.versionId,
  );
  if (relationError) return NextResponse.json({ error: relationError }, { status: 400 });
  const milestone = await prisma.$transaction(async (tx) => {
    const updated = await tx.milestone.update({
      where: { id: milestoneId },
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        ownerId: parsed.data.ownerId || null,
        versionId: parsed.data.versionId || null,
        dueAt: new Date(parsed.data.dueAt),
        status: parsed.data.status,
        completedAt:
          parsed.data.status === "COMPLETED" ? existing.completedAt || new Date() : null,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: auth.userId,
        projectId,
        actorType: "USER",
        action: "UPDATE_MILESTONE",
        resource: "MILESTONE",
        resourceId: milestoneId,
        channel: "WEB",
        metadata: { projectId, result: "SUCCESS" },
      },
    });
    return updated;
  });
  return NextResponse.json({ milestone });
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const { projectId, milestoneId } = await params;
  const auth = await manager(request, projectId);
  if ("error" in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const existing = await prisma.milestone.findFirst({
    where: { id: milestoneId, projectId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "里程碑不存在" }, { status: 404 });
  await prisma.$transaction([
    prisma.milestone.delete({ where: { id: milestoneId } }),
    prisma.auditLog.create({
      data: {
        userId: auth.userId,
        projectId,
        actorType: "USER",
        action: "DELETE_MILESTONE",
        resource: "MILESTONE",
        resourceId: milestoneId,
        channel: "WEB",
        metadata: { projectId, result: "SUCCESS" },
      },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
