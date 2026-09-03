import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRequestUserId } from "@/lib/team-permissions";
import { getProjectAccess } from "@/lib/project-permissions";
import { nextTaskCompletedAt } from "@/lib/project-overview";
import { opaqueId, optionalOpaqueId, taskPatchSchema, validateTaskReferences, validateTaskStatusTransition } from "@/lib/task-workflow";

const ids = optionalOpaqueId;
const baseSchemas = {
  requirements: z.object({
    title: z.string().min(2).max(120),
    description: z.string().max(5000),
    acceptanceCriteria: z.string().min(2).max(5000),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
    status: z.string().min(1).max(30),
    targetVersionId: ids,
    participantIds: z.array(opaqueId).default([]),
  }),
  tasks: taskPatchSchema,
  bugs: z.object({
    title: z.string().min(2).max(120),
    description: z.string().max(5000),
    reproduceSteps: z.string().min(2).max(5000),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
    status: z.enum([
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
    ]),
    requirementId: ids,
    taskId: ids,
    foundVersionId: ids,
    fixedVersionId: ids,
  }),
  versions: z.object({
    name: z.string().min(1).max(50),
    goal: z.string().min(2).max(3000),
    status: z.enum([
      "PLANNING",
      "DEVELOPING",
      "TESTING",
      "PENDING_RELEASE",
      "RELEASED",
      "ARCHIVED",
      "CANCELLED",
    ]),
    plannedAt: z.string().datetime().nullable().optional(),
    description: z.string().max(20000),
    ownerId: ids,
    participantIds: z.array(opaqueId).default([]),
    fileIds: z.array(opaqueId).default([]),
  }),
  releases: z.object({
    versionId: opaqueId,
    build: z.string().min(1).max(80),
    environment: z.string().min(1).max(50),
    notes: z.string().max(5000),
    rollbackPlan: z.string().min(2).max(5000),
    status: z.enum([
      "PLANNED",
      "RUNNING",
      "SUCCEEDED",
      "FAILED",
      "ROLLED_BACK",
    ]),
    releasedAt: z.string().datetime().nullable().optional(),
  }),
} as const;
const resources = {
  requirements: "REQUIREMENT",
  tasks: "TASK",
  bugs: "BUG",
  versions: "VERSION",
  releases: "RELEASE",
} as const;
const clean = (data: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v === "" ? null : v]),
  );
async function owns(module: string, id: string, projectId: string) {
  if (module === "requirements")
    return prisma.requirement.findFirst({ where: { id, projectId } });
  if (module === "tasks")
    return prisma.task.findFirst({ where: { id, projectId } });
  if (module === "bugs")
    return prisma.bug.findFirst({ where: { id, projectId } });
  if (module === "versions")
    return prisma.version.findFirst({ where: { id, projectId } });
  if (module === "releases")
    return prisma.release.findFirst({ where: { id, projectId } });
  return null;
}

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ projectId: string; module: string; itemId: string }> },
) {
  const userId = await getRequestUserId(request);
  const { projectId, module, itemId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const access = await getProjectAccess(projectId, userId);
  if (!(
    access?.canManage ||
    (access?.projectMember && access.projectMember.role !== "GUEST")
  ))
    return NextResponse.json({ error: "没有编辑权限" }, { status: 403 });
  if (!(module in baseSchemas) || !(await owns(module, itemId, projectId)))
    return NextResponse.json({ error: "记录不存在" }, { status: 404 });
  const parsed = baseSchemas[module as keyof typeof baseSchemas].safeParse(
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
  if (module === "tasks") {
    const invalid = await validateTaskReferences(projectId, data, itemId);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    const { dependencyIds, ...taskData } = data;
    const existing = await prisma.task.findUnique({
      where: { id: itemId },
      select: { completedAt: true, firstCompletedAt: true, status: true, assigneeId: true, acceptorId: true },
    });
    if (existing && data.status && data.status !== existing.status) {
      const canWrite = Boolean(access.canManage || (access.projectMember && access.projectMember.role !== "GUEST"));
      const transitionError = validateTaskStatusTransition(existing, userId, canWrite, data.status as typeof existing.status);
      if (transitionError) return NextResponse.json({ error: transitionError.error }, { status: transitionError.status });
    }
    const completedAt = data.status === undefined ? existing?.completedAt : nextTaskCompletedAt(String(data.status), existing?.completedAt);
    const taskDependencyIds = dependencyIds as string[] | undefined;
    await prisma.$transaction([
      ...(taskDependencyIds === undefined ? [] : [prisma.taskDependency.deleteMany({ where: { taskId: itemId } })]),
      prisma.task.update({
        where: { id: itemId },
        data: {
          ...taskData,
          completedAt,
          firstCompletedAt: existing?.firstCompletedAt || completedAt,
          ...(data.status === undefined ? {} : { closedAt: completedAt }),
        } as Prisma.TaskUncheckedUpdateInput,
      }),
      ...(taskDependencyIds?.length
        ? [prisma.taskDependency.createMany({ data: taskDependencyIds.map((dependsOnId) => ({ taskId: itemId, dependsOnId })) })]
        : []),
    ]);
  } else if (module === "requirements") {
    const { participantIds: _participantIds, ...requirementData } = data;
    void _participantIds;
    const existing = await prisma.requirement.findUnique({ where: { id: itemId }, select: { closedAt: true } });
    await prisma.requirement.update({
      where: { id: itemId },
      data: {
        ...requirementData,
        closedAt: data.status === "DONE" ? existing?.closedAt || new Date() : null,
        participants: {
          deleteMany: {},
          ...(participantIds.length
            ? { createMany: { data: [...new Set(participantIds)].map((participantId) => ({ userId: participantId })) } }
            : {}),
        },
      } as Prisma.RequirementUpdateInput,
    });
  }
  else if (module === "bugs") {
    const existing = await prisma.bug.findUnique({ where: { id: itemId }, select: { closedAt: true } });
    const closed = data.status === "CLOSED" || data.status === "REJECTED";
    await prisma.bug.update({
      where: { id: itemId },
      data: { ...data, closedAt: closed ? existing?.closedAt || new Date() : null } as Prisma.BugUncheckedUpdateInput,
    });
  }
  else if (module === "versions") {
    const { participantIds: _participantIds, fileIds: _fileIds, ownerId: _ownerId, ...versionData } = data;
    void _participantIds; void _fileIds; void _ownerId;
    await prisma.$transaction(async (tx) => {
      await tx.version.update({
        where: { id: itemId },
        data: {
          ...versionData,
          owner: { connect: { id: ownerId || userId } },
          participants: {
            deleteMany: {},
            ...(participantIds.length
              ? { createMany: { data: [...new Set(participantIds)].map((participantId) => ({ userId: participantId })) } }
              : {}),
          },
        } as Prisma.VersionUpdateInput,
      });
      await tx.resourceLink.deleteMany({ where: { resourceType: "VERSION", resourceId: itemId } });
      if (fileIds.length)
        await tx.resourceLink.createMany({
          data: [...new Set(fileIds)].map((fileId) => ({ fileId, resourceType: "VERSION", resourceId: itemId })),
        });
    });
  }
  else
    await prisma.release.update({ where: { id: itemId }, data: data as Prisma.ReleaseUncheckedUpdateInput });
  await prisma.auditLog.create({
    data: {
      userId,
      projectId,
      actorType: "USER",
      action: `UPDATE_${resources[module as keyof typeof resources]}`,
      resource: resources[module as keyof typeof resources],
      resourceId: itemId,
      channel: "WEB",
      metadata: { projectId, result: "SUCCESS" },
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ projectId: string; module: string; itemId: string }> },
) {
  const userId = await getRequestUserId(request);
  const { projectId, module, itemId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const access = await getProjectAccess(projectId, userId);
  if (!access?.canManage)
    return NextResponse.json(
      { error: "只有项目管理员可以删除" },
      { status: 403 },
    );
  if (!(module in resources) || !(await owns(module, itemId, projectId)))
    return NextResponse.json({ error: "记录不存在" }, { status: 404 });
  try {
    if (module === "requirements")
      await prisma.requirement.delete({ where: { id: itemId } });
    else if (module === "tasks")
      await prisma.task.delete({ where: { id: itemId } });
    else if (module === "bugs")
      await prisma.bug.delete({ where: { id: itemId } });
    else if (module === "versions")
      await prisma.$transaction([
        prisma.resourceLink.deleteMany({ where: { resourceType: "VERSION", resourceId: itemId } }),
        prisma.version.delete({ where: { id: itemId } }),
      ]);
    else await prisma.release.delete({ where: { id: itemId } });
  } catch {
    return NextResponse.json(
      { error: "该记录仍被其他工作项引用，请先解除关联" },
      { status: 409 },
    );
  }
  await prisma.auditLog.create({
    data: {
      userId,
      projectId,
      actorType: "USER",
      action: `DELETE_${resources[module as keyof typeof resources]}`,
      resource: resources[module as keyof typeof resources],
      resourceId: itemId,
      channel: "WEB",
      metadata: { projectId, result: "SUCCESS" },
    },
  });
  return NextResponse.json({ ok: true });
}
