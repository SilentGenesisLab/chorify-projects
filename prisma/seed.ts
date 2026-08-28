import { PrismaClient, Priority, ProjectRole, SystemRole, TaskStatus, TeamRole, VersionStatus } from "@prisma/client";
import { hash } from "bcryptjs";
import { createTeamInviteToken, encryptTeamInviteToken } from "../src/lib/security";

const prisma = new PrismaClient();

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.taskDependency.deleteMany();
  await prisma.acceptance.deleteMany();
  await prisma.workReport.deleteMany();
  await prisma.bug.deleteMany();
  await prisma.task.deleteMany();
  await prisma.requirement.deleteMany();
  await prisma.release.deleteMany();
  await prisma.version.deleteMany();
  await prisma.fileAsset.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.teamInvite.deleteMany();
  await prisma.apiToken.deleteMany();
  await prisma.project.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.smsCode.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hash("Chorify2026!", 12);
  const [chen, lin, zhou, su] = await Promise.all([
    prisma.user.create({ data: { name: "陈默", phone: "13800000001", passwordHash, systemRole: SystemRole.ADMIN } }),
    prisma.user.create({ data: { name: "林舟", phone: "13800000002", passwordHash } }),
    prisma.user.create({ data: { name: "周青", phone: "13800000003", passwordHash } }),
    prisma.user.create({ data: { name: "苏禾", phone: "13800000004", passwordHash } }),
  ]);
  const invite = createTeamInviteToken();
  const team = await prisma.team.create({ data: {
    name: "Chorify Projects",
    description: "负责 Chorify 项目协作平台的产品、研发与交付",
    members: { create: [
      { userId: chen.id, role: TeamRole.OWNER },
      { userId: lin.id, role: TeamRole.ADMIN },
      { userId: zhou.id, role: TeamRole.MEMBER },
      { userId: su.id, role: TeamRole.MEMBER },
    ] },
    invites: { create: {
      createdById: chen.id, role: TeamRole.MEMBER, prefix: invite.prefix,
      tokenHash: invite.tokenHash, tokenCiphertext: encryptTeamInviteToken(invite.token), maxUses: 50, expiresAt: new Date(Date.now() + 7 * 86_400_000),
    } },
  } });
  const project = await prisma.project.create({ data: {
    teamId: team.id, code: "CP", name: "Chorify Projects", description: "面向真人团队与 Codex 协作的项目工作空间",
    startDate: new Date("2026-08-01"), endDate: new Date("2026-09-30"),
    members: { create: [
      { userId: chen.id, role: ProjectRole.OWNER, responsibility: "产品与项目管理" },
      { userId: lin.id, role: ProjectRole.MANAGER, responsibility: "研发与任务验收" },
      { userId: zhou.id, role: ProjectRole.MEMBER, responsibility: "前端体验" },
      { userId: su.id, role: ProjectRole.MEMBER, responsibility: "测试与质量" },
    ]}
  }});
  const version = await prisma.version.create({ data: { projectId: project.id, name: "V0.9", goal: "完成协作内测闭环", description: "## V0.9 范围\n\n完成任务提交、验收与版本发布的核心闭环。", ownerId: lin.id, status: VersionStatus.DEVELOPING, plannedAt: new Date("2026-09-05") } });
  const requirement = await prisma.requirement.create({ data: { code: "REQ-12", projectId: project.id, title: "任务提交与验收闭环", description: "成员可以提交结构化工作汇报并由指定验收人处理", acceptanceCriteria: "提交人与验收人分离，完整保留操作记录", priority: Priority.HIGH, status: "IN_PROGRESS", requesterId: chen.id, targetVersionId: version.id } });
  await prisma.requirementParticipant.createMany({ data: [{ requirementId: requirement.id, userId: lin.id }, { requirementId: requirement.id, userId: zhou.id }] });
  await prisma.versionParticipant.createMany({ data: [{ versionId: version.id, userId: chen.id }, { versionId: version.id, userId: su.id }] });
  const t1 = await prisma.task.create({ data: { code: "CP-142", projectId: project.id, requirementId: requirement.id, versionId: version.id, title: "完成项目成员权限矩阵", description: "定义系统和项目两级权限", acceptanceCriteria: "覆盖管理员、所有者、经理、成员和访客", priority: Priority.HIGH, status: TaskStatus.IN_PROGRESS, assigneeId: chen.id, coordinatorId: lin.id, acceptorId: lin.id, dueAt: new Date("2026-08-27T18:00:00+08:00") } });
  const t2 = await prisma.task.create({ data: { code: "CP-138", projectId: project.id, requirementId: requirement.id, versionId: version.id, title: "梳理任务提交与验收流程", description: "固化任务状态和汇报字段", acceptanceCriteria: "能够提交、退回和验收", priority: Priority.MEDIUM, status: TaskStatus.PENDING_ACCEPTANCE, assigneeId: lin.id, coordinatorId: chen.id, acceptorId: chen.id, dueAt: new Date("2026-08-28T18:00:00+08:00") } });
  await prisma.taskDependency.create({ data: { taskId: t1.id, dependsOnId: t2.id } });
  await prisma.bug.create({ data: { code: "BUG-27", projectId: project.id, taskId: t2.id, foundVersionId: version.id, fixedVersionId: version.id, title: "退回验收后状态未同步", description: "任务退回后仍显示待验收", reproduceSteps: "提交任务后由验收人选择需要修改", severity: Priority.HIGH, status: "FIXING" } });
  const file = await prisma.fileAsset.create({ data: { projectId: project.id, name: "权限矩阵-v2.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 24836, tags: ["权限", "V0.9"] } });
  await prisma.resourceLink.create({ data: { fileId: file.id, resourceType: "VERSION", resourceId: version.id } });
  await prisma.auditLog.createMany({ data: [
    { userId: lin.id, actorType: "USER", action: "SUBMIT_REPORT", resource: "TASK", resourceId: t2.id, channel: "WEB", metadata: { taskCode: "CP-138" } },
    { userId: chen.id, actorType: "USER", action: "UPDATE_PERMISSION", resource: "PROJECT", resourceId: project.id, channel: "WEB" },
  ] });
}

main().finally(() => prisma.$disconnect());
