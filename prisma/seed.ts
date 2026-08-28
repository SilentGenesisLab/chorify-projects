import { MilestoneStatus, PrismaClient, Priority, ProjectRole, SystemRole, TaskStatus, TeamRole, VersionStatus } from "@prisma/client";
import { hash } from "bcryptjs";
import { createTeamInviteToken, encryptTeamInviteToken } from "../src/lib/security";

const prisma = new PrismaClient();

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.teamMessageRecipient.deleteMany();
  await prisma.teamMessage.deleteMany();
  await prisma.teamKeyResultCheckIn.deleteMany();
  await prisma.teamKeyResultAlignment.deleteMany();
  await prisma.teamKeyResult.deleteMany();
  await prisma.teamObjective.deleteMany();
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
    mission: "让真人团队与 Codex 在统一协议下清晰协作、可靠交付。",
    responsibilities: "产品规划与需求治理\n项目研发与质量保障\n版本发布与协作规范建设",
    members: { create: [
      { userId: chen.id, role: TeamRole.OWNER, title: "产品负责人", responsibility: "产品方向、项目优先级与验收决策", bio: "关注复杂协作流程的产品化与交付确定性。" },
      { userId: lin.id, role: TeamRole.ADMIN, title: "技术负责人", responsibility: "系统架构、研发推进与代码质量", bio: "负责核心工程架构和技术交付。" },
      { userId: zhou.id, role: TeamRole.MEMBER, title: "前端工程师", responsibility: "交互体验、前端实现与可访问性", bio: "专注高信息密度企业工具体验。" },
      { userId: su.id, role: TeamRole.MEMBER, title: "质量工程师", responsibility: "测试策略、缺陷验证与发布质量", bio: "守护从需求到上线的质量闭环。" },
    ] },
    invites: { create: {
      createdById: chen.id, role: TeamRole.MEMBER, prefix: invite.prefix,
      tokenHash: invite.tokenHash, tokenCiphertext: encryptTeamInviteToken(invite.token), maxUses: 50, expiresAt: new Date(Date.now() + 7 * 86_400_000),
    } },
  } });
  const project = await prisma.project.create({ data: {
    teamId: team.id, code: "CP", name: "Chorify Projects", description: "面向真人团队与 Codex 协作的项目工作空间",
    background: "## 项目背景\n\n团队需要一个以真人责任制为核心、同时允许成员通过 Codex API Key 完成查询和工作汇报的统一协作平台。\n\n- 汇总需求、任务、Bug 与版本范围\n- 让交付、验收和文件引用形成闭环\n- 所有操作都归属于真实成员",
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
  await prisma.task.create({ data: { code: "CP-131", projectId: project.id, requirementId: requirement.id, versionId: version.id, title: "完成项目工作空间信息架构", description: "确定项目内需求、任务、Bug、版本和文件导航", acceptanceCriteria: "项目导航结构通过评审", priority: Priority.MEDIUM, status: TaskStatus.DONE, assigneeId: zhou.id, coordinatorId: lin.id, acceptorId: chen.id, completedAt: new Date("2026-08-26T16:30:00+08:00") } });
  await prisma.milestone.createMany({ data: [
    { projectId: project.id, versionId: version.id, ownerId: lin.id, title: "完成核心流程内测", description: "需求、任务提交与验收流程可供团队完整试用", status: MilestoneStatus.IN_PROGRESS, dueAt: new Date("2026-09-01T18:00:00+08:00") },
    { projectId: project.id, versionId: version.id, ownerId: su.id, title: "V0.9 预发布验收", description: "完成回归测试、发布清单与回滚方案确认", status: MilestoneStatus.PLANNED, dueAt: new Date("2026-09-05T18:00:00+08:00") },
  ] });
  const completed = await prisma.task.create({ data: { code: "CP-121", projectId: project.id, requirementId: requirement.id, versionId: version.id, title: "完成团队信息架构", description: "形成团队管理页面结构", acceptanceCriteria: "评审通过", priority: Priority.MEDIUM, status: TaskStatus.DONE, assigneeId: zhou.id, coordinatorId: chen.id, acceptorId: su.id, dueAt: new Date("2026-08-26T18:00:00+08:00"), closedAt: new Date("2026-08-26T16:30:00+08:00") } });
  await prisma.acceptance.create({ data: { taskId: completed.id, reviewerId: su.id, result: "PASSED", comment: "信息架构完整，可以进入实现。", createdAt: new Date("2026-08-26T16:30:00+08:00") } });
  await prisma.taskDependency.create({ data: { taskId: t1.id, dependsOnId: t2.id } });
  await prisma.bug.create({ data: { code: "BUG-27", projectId: project.id, taskId: t2.id, foundVersionId: version.id, fixedVersionId: version.id, title: "退回验收后状态未同步", description: "任务退回后仍显示待验收", reproduceSteps: "提交任务后由验收人选择需要修改", severity: Priority.HIGH, status: "FIXING" } });
  const file = await prisma.fileAsset.create({ data: { projectId: project.id, name: "权限矩阵-v2.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 24836, tags: ["权限", "V0.9"] } });
  await prisma.resourceLink.create({ data: { fileId: file.id, resourceType: "VERSION", resourceId: version.id } });
  await prisma.teamObjective.create({ data: { teamId: team.id, title: "完成 Chorify 协作核心闭环", description: "让团队、项目、任务、验收和消息形成可靠闭环", periodType: "QUARTERLY", periodLabel: "2026 Q3", startsAt: new Date("2026-07-01T00:00:00+08:00"), endsAt: new Date("2026-09-30T23:59:59+08:00"), ownerId: chen.id, status: "ACTIVE", keyResults: { create: [{ title: "核心工作流验收通过率达到 90%", targetValue: 90, currentValue: 68, unit: "%", confidence: 78, ownerId: lin.id, alignments: { create: [{ userId: zhou.id }, { userId: su.id }] }, checkIns: { create: { authorId: lin.id, currentValue: 68, confidence: 78, note: "项目工作区与文件闭环已完成，团队协同能力开发中。" } } }, { title: "高优先级缺陷按期关闭率达到 95%", targetValue: 95, currentValue: 82, unit: "%", confidence: 85, ownerId: su.id, alignments: { create: { userId: lin.id } } }] } } });
  await prisma.teamMessage.create({ data: { teamId: team.id, senderId: chen.id, title: "本周协作重点", body: "请优先完成团队协同页面联调，并在任务中提交验证记录。", priority: "IMPORTANT", projectId: project.id, recipients: { create: [{ userId: lin.id, readAt: new Date("2026-08-28T10:00:00+08:00") }, { userId: zhou.id }, { userId: su.id }] } } });
  await prisma.auditLog.createMany({ data: [
    { userId: lin.id, actorType: "USER", action: "SUBMIT_REPORT", resource: "TASK", resourceId: t2.id, channel: "WEB", metadata: { taskCode: "CP-138" } },
    { userId: chen.id, actorType: "USER", action: "UPDATE_PERMISSION", resource: "PROJECT", resourceId: project.id, channel: "WEB" },
  ] });
}

main().finally(() => prisma.$disconnect());
