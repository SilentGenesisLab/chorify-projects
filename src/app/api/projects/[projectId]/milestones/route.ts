import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUserId } from "@/lib/team-permissions";
import { getProjectAccess } from "@/lib/project-permissions";
import { milestoneSchema, validateMilestoneRelations } from "@/lib/milestone";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const userId = await getRequestUserId(request);
  const { projectId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const access = await getProjectAccess(projectId, userId);
  if (!access?.canManage)
    return NextResponse.json({ error: "只有项目经理或所有者可以维护里程碑" }, { status: 403 });
  const parsed = milestoneSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "里程碑信息不完整" },
      { status: 400 },
    );
  const relationError = await validateMilestoneRelations(
    projectId,
    parsed.data.ownerId,
    parsed.data.versionId,
  );
  if (relationError) return NextResponse.json({ error: relationError }, { status: 400 });
  const milestone = await prisma.$transaction(async (tx) => {
    const created = await tx.milestone.create({
      data: {
        projectId,
        title: parsed.data.title,
        description: parsed.data.description,
        ownerId: parsed.data.ownerId || null,
        versionId: parsed.data.versionId || null,
        dueAt: new Date(parsed.data.dueAt),
        status: parsed.data.status,
        completedAt: parsed.data.status === "COMPLETED" ? new Date() : null,
      },
    });
    await tx.auditLog.create({
      data: {
        userId,
        projectId,
        actorType: "USER",
        action: "CREATE_MILESTONE",
        resource: "MILESTONE",
        resourceId: created.id,
        channel: "WEB",
        metadata: { projectId, result: "SUCCESS" },
      },
    });
    return created;
  });
  return NextResponse.json({ milestone }, { status: 201 });
}
