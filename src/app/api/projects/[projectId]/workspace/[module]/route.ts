import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRequestUserId } from "@/lib/team-permissions";
import { getProjectAccess } from "@/lib/project-permissions";

const optionalId = z.string().cuid().nullable().optional();
const schemas = {
  requirements: z.object({
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(5000).default(""),
    acceptanceCriteria: z.string().trim().min(2).max(5000),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
    status: z.string().trim().min(1).max(30),
    targetVersionId: optionalId,
    participantIds: z.array(z.string().cuid()).default([]),
  }),
  tasks: z.object({
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(5000).default(""),
    acceptanceCriteria: z.string().trim().min(2).max(5000),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
    status: z
      .enum([
        "TODO",
        "IN_PROGRESS",
        "PENDING_ACCEPTANCE",
        "NEEDS_CHANGES",
        "ACCEPTED",
        "DONE",
      ])
      .default("TODO"),
    dueAt: z.string().datetime().nullable().optional(),
    requirementId: optionalId,
    versionId: optionalId,
    assigneeId: optionalId,
    coordinatorId: optionalId,
    acceptorId: optionalId,
    dependencyIds: z.array(z.string().cuid()).default([]),
  }),
  bugs: z.object({
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(5000).default(""),
    reproduceSteps: z.string().trim().min(2).max(5000),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
    status: z
      .enum([
        "NEW",
        "CONFIRMED",
        "ASSIGNED",
        "FIXING",
        "PENDING_VERIFICATION",
        "VERIFIED",
        "PENDING_RELEASE",
        "CLOSED",
        "REOPENED",
        "DEFERRED",
        "REJECTED",
      ])
      .default("NEW"),
    requirementId: optionalId,
    taskId: optionalId,
    foundVersionId: optionalId,
    fixedVersionId: optionalId,
  }),
  versions: z.object({
    name: z.string().trim().min(1).max(50),
    goal: z.string().trim().min(2).max(3000),
    status: z
      .enum([
        "PLANNING",
        "DEVELOPING",
        "TESTING",
        "PENDING_RELEASE",
        "RELEASED",
        "ARCHIVED",
        "CANCELLED",
      ])
      .default("PLANNING"),
    plannedAt: z.string().datetime().nullable().optional(),
    description: z.string().trim().max(20000).default(""),
    ownerId: optionalId,
    participantIds: z.array(z.string().cuid()).default([]),
    fileIds: z.array(z.string().cuid()).default([]),
  }),
  releases: z.object({
    versionId: z.string().cuid(),
    build: z.string().trim().min(1).max(80),
    environment: z.string().trim().min(1).max(50),
    notes: z.string().trim().max(5000).default(""),
    rollbackPlan: z.string().trim().min(2).max(5000),
    status: z
      .enum(["PLANNED", "RUNNING", "SUCCEEDED", "FAILED", "ROLLED_BACK"])
      .default("PLANNED"),
    releasedAt: z.string().datetime().nullable().optional(),
  }),
} as const;

const clean = (data: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      value === "" ? null : value,
    ]),
  );
const moduleResource = {
  requirements: "REQUIREMENT",
  tasks: "TASK",
  bugs: "BUG",
  versions: "VERSION",
  releases: "RELEASE",
} as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; module: string }> },
) {
  const userId = await getRequestUserId(request);
  const { projectId, module } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const access = await getProjectAccess(projectId, userId);
  const canWrite = Boolean(
    access?.canManage ||
    (access?.projectMember && access.projectMember.role !== "GUEST"),
  );
  if (!canWrite)
    return NextResponse.json(
      { error: "没有编辑该项目的权限" },
      { status: 403 },
    );
  if (!(module in schemas))
    return NextResponse.json({ error: "不支持的业务模块" }, { status: 404 });
  const parsed = schemas[module as keyof typeof schemas].safeParse(
    await request.json(),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "数据不完整" },
      { status: 400 },
    );
  const data = clean(parsed.data as Record<string, unknown>);
  const participantIds = (data.participantIds || []) as string[];
  const fileIds = (data.fileIds || []) as string[];
  const ownerId = data.ownerId as string | null | undefined;
  const projectMemberIds = new Set(
    (await prisma.projectMember.findMany({ where: { projectId }, select: { userId: true } })).map((x) => x.userId),
  );
  if (participantIds.some((id) => !projectMemberIds.has(id)))
    return NextResponse.json({ error: "参与人必须是项目成员" }, { status: 400 });
  if (module === "versions" && ownerId && ownerId !== userId && !projectMemberIds.has(ownerId))
    return NextResponse.json({ error: "负责人必须是项目成员" }, { status: 400 });
  if (module === "versions" && fileIds.length) {
    const count = await prisma.fileAsset.count({ where: { id: { in: fileIds }, projectId, deletedAt: null } });
    if (count !== new Set(fileIds).size)
      return NextResponse.json({ error: "只能引用当前项目中有效的文件" }, { status: 400 });
  }
  const code = `${(await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { code: true } })).code}-${Date.now().toString().slice(-8)}`;
  let item: { id: string };
  if (module === "requirements") {
    const { participantIds: _participantIds, targetVersionId, ...requirementData } = data;
    void _participantIds;
    item = await prisma.requirement.create({
      data: {
        ...requirementData,
        code,
        project: { connect: { id: projectId } },
        requester: { connect: { id: userId } },
        targetVersion: targetVersionId ? { connect: { id: targetVersionId as string } } : undefined,
        closedAt: data.status === "DONE" ? new Date() : null,
        participants: participantIds.length
          ? { createMany: { data: [...new Set(participantIds)].map((participantId) => ({ userId: participantId })) } }
          : undefined,
      } as unknown as Prisma.RequirementCreateInput,
    });
  }
  else if (module === "tasks") {
    const { dependencyIds, ...taskData } = data;
    item = await prisma.task.create({
      data: { ...taskData, code, projectId } as Prisma.TaskUncheckedCreateInput,
    });
    if ((dependencyIds as string[]).length)
      await prisma.taskDependency.createMany({
        data: (dependencyIds as string[]).map((dependsOnId) => ({
          taskId: item.id,
          dependsOnId,
        })),
      });
  } else if (module === "bugs")
    item = await prisma.bug.create({
      data: { ...data, code, projectId } as Prisma.BugUncheckedCreateInput,
    });
  else if (module === "versions") {
    const { participantIds: _participantIds, fileIds: _fileIds, ownerId: _ownerId, ...versionData } = data;
    void _participantIds; void _fileIds; void _ownerId;
    item = await prisma.$transaction(async (tx) => {
      const version = await tx.version.create({
        data: {
          ...versionData,
          owner: { connect: { id: ownerId || userId } },
          project: { connect: { id: projectId } },
          participants: participantIds.length
            ? { createMany: { data: [...new Set(participantIds)].map((participantId) => ({ userId: participantId })) } }
            : undefined,
        } as unknown as Prisma.VersionCreateInput,
      });
      if (fileIds.length)
        await tx.resourceLink.createMany({
          data: [...new Set(fileIds)].map((fileId) => ({ fileId, resourceType: "VERSION", resourceId: version.id })),
        });
      return version;
    });
  }
  else
    item = await prisma.release.create({
      data: { ...data, projectId } as Prisma.ReleaseUncheckedCreateInput,
    });
  await prisma.auditLog.create({
    data: {
      userId,
      actorType: "USER",
      action: `CREATE_${moduleResource[module as keyof typeof moduleResource]}`,
      resource: moduleResource[module as keyof typeof moduleResource],
      resourceId: item.id,
      channel: "WEB",
      metadata: { projectId, result: "SUCCESS" },
    },
  });
  return NextResponse.json({ item }, { status: 201 });
}
