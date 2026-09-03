import type { Priority, TaskStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getProjectAccess } from "@/lib/project-permissions";

export const opaqueId = z.string().trim().min(1, "关联记录不能为空").max(191, "关联记录 ID 过长");
export const optionalOpaqueId = opaqueId.nullable().optional();

export const taskFieldsSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(5000).default(""),
  acceptanceCriteria: z.string().trim().min(2).max(5000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  status: z.enum(["TODO", "IN_PROGRESS", "PENDING_ACCEPTANCE", "NEEDS_CHANGES", "ACCEPTED", "DONE"]),
  dueAt: z.string().datetime().nullable().optional(),
  requirementId: optionalOpaqueId,
  versionId: optionalOpaqueId,
  assigneeId: optionalOpaqueId,
  coordinatorId: optionalOpaqueId,
  acceptorId: optionalOpaqueId,
  dependencyIds: z.array(opaqueId).default([]),
});

export const taskPatchSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(5000).optional(),
  acceptanceCriteria: z.string().trim().min(2).max(5000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "PENDING_ACCEPTANCE", "NEEDS_CHANGES", "ACCEPTED", "DONE"]).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  requirementId: optionalOpaqueId,
  versionId: optionalOpaqueId,
  assigneeId: optionalOpaqueId,
  coordinatorId: optionalOpaqueId,
  acceptorId: optionalOpaqueId,
  dependencyIds: z.array(opaqueId).optional(),
}).refine((value) => Object.keys(value).length > 0, "没有可更新的字段");

export const taskQuickUpdateSchema = z.object({
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "PENDING_ACCEPTANCE"]).optional(),
}).refine((value) => value.priority !== undefined || value.status !== undefined, "没有可更新的字段");

export const taskAcceptanceSchema = z.object({
  decision: z.enum(["PASS", "NEEDS_CHANGES"]),
  conclusion: z.string().trim().min(3).max(3000),
  verificationEvidence: z.string().trim().min(3).max(5000),
});

type TaskWriteData = Partial<z.infer<typeof taskFieldsSchema>>;
type WorkflowResult<T> = { ok: true; value: T } | { ok: false; error: string; status: number };

function failure(error: string, status = 400): WorkflowResult<never> {
  return { ok: false, error, status };
}

export async function prepareTaskCreate(projectId: string, userId: string, input: z.infer<typeof taskFieldsSchema>): Promise<WorkflowResult<z.infer<typeof taskFieldsSchema>>> {
  if (!["TODO", "IN_PROGRESS"].includes(input.status)) return failure("新任务只能创建为待处理或进行中状态");
  const membership = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } }, select: { userId: true } });
  const assigneeId = input.assigneeId || membership?.userId;
  if (!assigneeId) return failure("请选择任务负责人；当前创建人不是项目成员，不能自动设为负责人");

  const requirement = input.requirementId
    ? await prisma.requirement.findFirst({ where: { id: input.requirementId, projectId }, select: { requesterId: true } })
    : null;
  if (input.requirementId && !requirement) return failure("关联需求不存在或不属于当前项目");

  const value = {
    ...input,
    assigneeId,
    acceptorId: input.acceptorId || requirement?.requesterId || userId,
    dependencyIds: [...new Set(input.dependencyIds)],
  };
  const invalid = await validateTaskReferences(projectId, value);
  return invalid ? failure(invalid) : { ok: true, value };
}

export async function validateTaskReferences(projectId: string, data: TaskWriteData, currentTaskId?: string): Promise<string | null> {
  const [project, projectMembers] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { teamId: true } }),
    prisma.projectMember.findMany({ where: { projectId }, select: { userId: true } }),
  ]);
  if (!project) return "项目不存在";
  const memberIds = new Set(projectMembers.map((item) => item.userId));

  if (data.assigneeId && !memberIds.has(data.assigneeId)) return "任务负责人必须是当前项目成员";
  if (data.coordinatorId && !memberIds.has(data.coordinatorId)) return "任务对接人必须是当前项目成员";

  if (data.acceptorId) {
    const projectMember = memberIds.has(data.acceptorId);
    const teamManager = project.teamId
      ? await prisma.teamMember.findFirst({ where: { teamId: project.teamId, userId: data.acceptorId, role: { in: ["OWNER", "ADMIN"] } }, select: { id: true } })
      : null;
    if (!projectMember && !teamManager) return "任务验收人必须是项目成员或所属团队管理员";
  }

  if (data.requirementId && !(await prisma.requirement.findFirst({ where: { id: data.requirementId, projectId }, select: { id: true } })))
    return "关联需求不存在或不属于当前项目";
  if (data.versionId && !(await prisma.version.findFirst({ where: { id: data.versionId, projectId }, select: { id: true } })))
    return "目标版本不存在或不属于当前项目";

  if (data.dependencyIds !== undefined) {
    const dependencyIds = [...new Set(data.dependencyIds)];
    if (currentTaskId && dependencyIds.includes(currentTaskId)) return "任务不能依赖自身";
    const count = dependencyIds.length
      ? await prisma.task.count({ where: { id: { in: dependencyIds }, projectId } })
      : 0;
    if (count !== dependencyIds.length) return "依赖任务不存在或不属于当前项目";
  }
  return null;
}

export async function quickUpdateTask(taskId: string, userId: string, input: z.infer<typeof taskQuickUpdateSchema>): Promise<WorkflowResult<{ id: string; priority: Priority; status: TaskStatus; updatedAt: Date }>> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return failure("任务不存在", 404);
  const access = await getProjectAccess(task.projectId, userId);
  if (!access?.canAccess) return failure("任务不存在或无权访问", 404);
  const canWrite = Boolean(access.canManage || (access.projectMember && access.projectMember.role !== "GUEST"));
  const isOwner = task.assigneeId === userId;

  if (input.priority && !isOwner && !canWrite) return failure("没有调整任务优先级的权限", 403);
  if (input.status && input.status !== task.status) {
    const transitionError = validateTaskStatusTransition(task, userId, canWrite, input.status);
    if (transitionError) return failure(transitionError.error, transitionError.status);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.task.update({ where: { id: taskId }, data: input });
    await tx.auditLog.create({
      data: {
        userId,
        actorType: "USER",
        action: input.status === "PENDING_ACCEPTANCE" ? "SUBMIT_TASK_ACCEPTANCE" : "QUICK_UPDATE_TASK",
        resource: "TASK",
        resourceId: taskId,
        channel: "WEB",
        metadata: { projectId: task.projectId, fields: Object.keys(input), fromStatus: task.status, toStatus: input.status, result: "SUCCESS" },
      },
    });
    return next;
  });
  return { ok: true, value: { id: updated.id, priority: updated.priority, status: updated.status, updatedAt: updated.updatedAt } };
}

export function validateTaskStatusTransition(
  task: { assigneeId: string | null; acceptorId: string | null; status: TaskStatus },
  userId: string,
  canWrite: boolean,
  targetStatus: TaskStatus,
) {
  const isOwner = task.assigneeId === userId;
  if (["ACCEPTED", "DONE"].includes(task.status)) return { error: "已闭环任务不能再调整状态", status: 409 };
  if (["ACCEPTED", "DONE", "NEEDS_CHANGES"].includes(targetStatus))
    return { error: "验收结果只能由指定验收人提交", status: 403 };
  if (task.status === "PENDING_ACCEPTANCE") return { error: "待验收任务只能由验收人通过或退回", status: 409 };
  if (targetStatus === "PENDING_ACCEPTANCE") {
    if (!isOwner) return { error: "只有任务负责人可以提交验收", status: 403 };
    if (!task.acceptorId) return { error: "请先设置验收人，再提交验收", status: 409 };
    if (!["TODO", "IN_PROGRESS", "NEEDS_CHANGES"].includes(task.status)) return { error: "当前状态不能提交验收", status: 409 };
  } else if (!isOwner && !canWrite) {
    return { error: "没有调整任务状态的权限", status: 403 };
  }
  return null;
}

export async function acceptTask(taskId: string, userId: string, input: z.infer<typeof taskAcceptanceSchema>): Promise<WorkflowResult<{ id: string; result: string; comment: string; verification: string; createdAt: Date }>> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return failure("任务不存在", 404);
  if (!(await getProjectAccess(task.projectId, userId))?.canAccess) return failure("任务不存在或无权访问", 404);
  if (task.acceptorId !== userId) return failure("只有指定验收人可以验收并闭环", 403);
  if (task.status !== "PENDING_ACCEPTANCE") return failure("任务当前不处于待验收状态", 409);

  const now = new Date();
  const passed = input.decision === "PASS";
  const acceptance = await prisma.$transaction(async (tx) => {
    const created = await tx.acceptance.create({
      data: { taskId, reviewerId: userId, result: input.decision, comment: input.conclusion, verification: input.verificationEvidence },
    });
    await tx.task.update({
      where: { id: taskId },
      data: { status: passed ? "DONE" : "NEEDS_CHANGES", completedAt: passed ? now : null, closedAt: passed ? now : null },
    });
    await tx.auditLog.create({
      data: {
        userId,
        actorType: "USER",
        action: passed ? "CLOSE_TASK" : "REJECT_TASK_ACCEPTANCE",
        resource: "TASK",
        resourceId: taskId,
        channel: "WEB",
        metadata: { projectId: task.projectId, decision: input.decision, result: "SUCCESS" },
      },
    });
    return created;
  });
  return { ok: true, value: acceptance };
}

export function taskDetailPermissions(task: { assigneeId: string | null; acceptorId: string | null; status: TaskStatus }, userId: string, canWrite: boolean) {
  const terminal = task.status === "ACCEPTED" || task.status === "DONE";
  const pending = task.status === "PENDING_ACCEPTANCE";
  return {
    canWrite,
    canEditPriority: !terminal && (canWrite || task.assigneeId === userId),
    canChangeStatus: !terminal && !pending && (canWrite || task.assigneeId === userId),
    canSubmitAcceptance: !terminal && !pending && task.assigneeId === userId,
    canAccept: pending && task.acceptorId === userId,
  };
}
