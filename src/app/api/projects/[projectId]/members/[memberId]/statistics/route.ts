import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProjectAccess } from "@/lib/project-permissions";
import { getRequestUserId } from "@/lib/team-permissions";

function shanghaiWeekBoundary() {
  const now = new Date(Date.now() + 8 * 3_600_000);
  now.setUTCHours(0, 0, 0, 0);
  now.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
  return new Date(now.getTime() - 8 * 3_600_000);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string; memberId: string }> }) {
  const viewerId = await getRequestUserId(request);
  if (!viewerId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { projectId, memberId } = await params;
  const [access, member] = await Promise.all([
    getProjectAccess(projectId, viewerId),
    prisma.projectMember.findFirst({ where: { id: memberId, projectId }, select: { id: true, userId: true, role: true } }),
  ]);
  if (!access?.canAccess || !member) return NextResponse.json({ error: "成员不存在或无权访问" }, { status: 403 });

  const week = shanghaiWeekBoundary();
  const [requirements, weeklyCompleted, currentTasks, pendingAcceptance] = await Promise.all([
    prisma.requirement.findMany({
      where: { projectId, requesterId: member.userId },
      select: { status: true, createdAt: true, closedAt: true },
    }),
    prisma.task.count({ where: { projectId, assigneeId: member.userId, completedAt: { gte: week } } }),
    prisma.task.findMany({
      where: { projectId, assigneeId: member.userId, status: { notIn: ["ACCEPTED", "DONE"] } },
      select: { id: true, code: true, title: true, status: true, priority: true, dueAt: true },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      take: 10,
    }),
    prisma.task.count({ where: { projectId, acceptorId: member.userId, status: "PENDING_ACCEPTANCE" } }),
  ]);
  const closed = requirements.filter((item) => item.status === "DONE");
  const durations = closed.flatMap((item) => item.closedAt ? [item.closedAt.getTime() - item.createdAt.getTime()] : []);
  const averageRequirementHours = durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length / 3_600_000) : null;
  return NextResponse.json({
    contribution: {
      requirementsProposed: requirements.length,
      requirementsClosed: closed.length,
      averageRequirementHours,
      weeklyCompletedTasks: weeklyCompleted,
      pendingAcceptance,
      currentTasks,
    },
  });
}
