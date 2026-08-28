import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUserId } from "@/lib/team-permissions";
import { AUDIT_ACTION_LABELS, DASHBOARD_ACTIVITY_ACTIONS } from "@/lib/audit-display";
import {
  dashboardTaskSort,
  isOpenTask,
  isShanghaiDay,
  selectDashboardVersion,
  shanghaiMonth,
} from "@/lib/dashboard";
import { calculateProjectProgress } from "@/lib/project-overview";

const CLOSED_BUGS = new Set(["CLOSED", "REJECTED"]);
const TERMINAL_MILESTONES = new Set(["COMPLETED", "CANCELLED"]);

const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export async function GET(request: NextRequest) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const now = new Date();
  const [user, projects, auditCandidates] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      where: {
        OR: [
          { members: { some: { userId } } },
          { team: { members: { some: { userId, role: { in: ["OWNER", "ADMIN"] } } } } },
        ],
      },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        requirements: { select: { status: true, targetVersionId: true } },
        tasks: {
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            priority: true,
            dueAt: true,
            versionId: true,
            assigneeId: true,
            acceptorId: true,
            assignee: { select: { id: true, name: true, avatarColor: true } },
          },
        },
        bugs: { select: { status: true, severity: true, fixedVersionId: true } },
        versions: {
          select: { id: true, name: true, status: true, plannedAt: true, updatedAt: true },
        },
        milestones: { select: { status: true, dueAt: true, versionId: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: { action: { in: [...DASHBOARD_ACTIVITY_ACTIONS] } },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
  ]);
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  const projectIds = new Set(projects.map((project) => project.id));
  const projectMap = new Map(
    projects.map((project) => [project.id, { id: project.id, code: project.code, name: project.name }]),
  );
  const activeProjects = projects.filter((project) => project.status === "ACTIVE");
  const myTasks = projects
    .flatMap((project) =>
      project.tasks
        .filter((task) => task.assigneeId === userId && isOpenTask(task.status))
        .map((task) => ({ ...task, project: projectMap.get(project.id)! })),
    )
    .sort((a, b) => dashboardTaskSort(a, b, now));
  const pendingAcceptance = projects
    .flatMap((project) => project.tasks)
    .filter((task) => task.acceptorId === userId && task.status === "PENDING_ACCEPTANCE");
  const dueToday = myTasks.filter((task) => isShanghaiDay(task.dueAt, now));
  const overdue = myTasks.filter((task) => task.dueAt && task.dueAt < now);
  const attentionIds = new Set([
    ...dueToday.map((task) => task.id),
    ...pendingAcceptance.map((task) => task.id),
    ...overdue.map((task) => task.id),
  ]);

  const projectStatus = activeProjects.slice(0, 5).map((project) => {
    const progress = calculateProjectProgress(project).overall;
    const overdueTaskCount = project.tasks.filter(
      (task) => isOpenTask(task.status) && task.dueAt && task.dueAt < now,
    ).length;
    const overdueMilestoneCount = project.milestones.filter(
      (milestone) => !TERMINAL_MILESTONES.has(milestone.status) && milestone.dueAt < now,
    ).length;
    const seriousBugCount = project.bugs.filter(
      (bug) => !CLOSED_BUGS.has(bug.status) && (bug.severity === "HIGH" || bug.severity === "URGENT"),
    ).length;
    return {
      id: project.id,
      code: project.code,
      name: project.name,
      progress,
      health: overdueTaskCount + overdueMilestoneCount + seriousBugCount ? "RISK" : "NORMAL",
      risks: { overdueTasks: overdueTaskCount, overdueMilestones: overdueMilestoneCount, seriousBugs: seriousBugCount },
    };
  });

  const version = selectDashboardVersion(
    projects.flatMap((project) =>
      project.versions.map((item) => ({ ...item, projectId: project.id })),
    ),
    now,
  );
  let currentVersion = null;
  if (version) {
    const project = projects.find((item) => item.id === version.projectId)!;
    const requirements = project.requirements.filter((item) => item.targetVersionId === version.id);
    const tasks = project.tasks.filter((item) => item.versionId === version.id);
    const bugs = project.bugs.filter((item) => item.fixedVersionId === version.id && item.status !== "REJECTED");
    const milestones = project.milestones.filter((item) => item.versionId === version.id && item.status !== "CANCELLED");
    const totalScope = requirements.length + tasks.length + bugs.length + milestones.length;
    const completedScope =
      requirements.filter((item) => item.status === "DONE").length +
      tasks.filter((item) => !isOpenTask(item.status)).length +
      bugs.filter((item) => item.status === "CLOSED").length +
      milestones.filter((item) => item.status === "COMPLETED").length;
    currentVersion = {
      id: version.id,
      name: version.name,
      status: version.status,
      plannedAt: version.plannedAt,
      project: projectMap.get(project.id)!,
      progress: calculateProjectProgress({ requirements, tasks, bugs, milestones }).overall,
      completedScope,
      totalScope,
    };
  }

  const activities = auditCandidates.flatMap((log) => {
    const metadata = asRecord(log.metadata);
    if (metadata.result && metadata.result !== "SUCCESS") return [];
    const projectId =
      typeof metadata.projectId === "string"
        ? metadata.projectId
        : log.resource === "PROJECT"
          ? log.resourceId
          : null;
    if (!projectId || !projectIds.has(projectId)) return [];
    return [{
      id: log.id,
      actor: log.user ? { id: log.user.id, name: log.user.name } : null,
      action: log.action,
      actionLabel: AUDIT_ACTION_LABELS[log.action] || log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      channel: log.channel,
      project: projectMap.get(projectId)!,
      createdAt: log.createdAt,
    }];
  }).slice(0, 8);

  return NextResponse.json({
    user,
    generatedAt: now,
    summary: {
      activeProjects: activeProjects.length,
      newProjectsThisMonth: activeProjects.filter(
        (project) => shanghaiMonth(project.createdAt) === shanghaiMonth(now),
      ).length,
      myOpenTasks: myTasks.length,
      dueToday: dueToday.length,
      pendingAcceptance: pendingAcceptance.length,
      overdueTasks: overdue.length,
      attentionCount: attentionIds.size,
    },
    tasks: myTasks.slice(0, 6).map((task) => ({
      id: task.id,
      code: task.code,
      title: task.title,
      priority: task.priority,
      status: task.status,
      dueAt: task.dueAt,
      overdue: Boolean(task.dueAt && task.dueAt < now),
      project: task.project,
      assignee: task.assignee,
    })),
    projects: projectStatus,
    currentVersion,
    activities,
  });
}
