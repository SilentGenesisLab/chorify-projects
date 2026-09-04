import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bigintNumber } from "@/lib/usage-collector";
import { getRequestUserId, getTeamMembership, isTeamManager } from "@/lib/team-permissions";

function shanghaiBoundary(kind: "today" | "week" | "month") {
  const now = new Date(Date.now() + 8 * 3_600_000);
  if (kind === "today") now.setUTCHours(0, 0, 0, 0);
  if (kind === "week") {
    now.setUTCHours(0, 0, 0, 0);
    now.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
  }
  if (kind === "month") {
    now.setUTCDate(1);
    now.setUTCHours(0, 0, 0, 0);
  }
  return new Date(now.getTime() - 8 * 3_600_000);
}

function sumUsage(rows: Array<{ inputTokens: bigint; outputTokens: bigint; cacheTokens: bigint; reasoningTokens: bigint; sessions: number }>) {
  const total = rows.reduce((sum, row) => ({
    input: sum.input + row.inputTokens,
    output: sum.output + row.outputTokens,
    cache: sum.cache + row.cacheTokens,
    reasoning: sum.reasoning + row.reasoningTokens,
    sessions: sum.sessions + row.sessions,
  }), { input: BigInt(0), output: BigInt(0), cache: BigInt(0), reasoning: BigInt(0), sessions: 0 });
  return {
    inputTokens: bigintNumber(total.input), outputTokens: bigintNumber(total.output), cacheTokens: bigintNumber(total.cache),
    reasoningTokens: bigintNumber(total.reasoning), totalTokens: bigintNumber(total.input + total.output + total.cache + total.reasoning), sessions: total.sessions,
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ teamId: string; memberId: string }> }) {
  const viewerId = await getRequestUserId(request);
  if (!viewerId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { teamId, memberId } = await params;
  const [viewer, member] = await Promise.all([
    getTeamMembership(teamId, viewerId),
    prisma.teamMember.findFirst({ where: { id: memberId, teamId }, select: { userId: true, role: true } }),
  ]);
  if (!viewer || !member) return NextResponse.json({ error: "成员不存在或无权访问" }, { status: 403 });
  if (viewer.role === "GUEST") return NextResponse.json({ error: "访客不可查看团队成员统计" }, { status: 403 });

  const today = shanghaiBoundary("today"), week = shanghaiBoundary("week"), month = shanghaiBoundary("month");
  const detailStart = new Date(today); detailStart.setUTCDate(detailStart.getUTCDate() - 29);
  const canViewDetails = isTeamManager(viewer.role) || viewerId === member.userId;
  const teamProject = { project: { teamId } };
  const [requirements, weeklyCompleted, currentTasks, pendingAcceptance, usageRows, devices] = await Promise.all([
    prisma.requirement.findMany({ where: { requesterId: member.userId, ...teamProject }, select: { status: true, createdAt: true, closedAt: true } }),
    prisma.task.count({ where: { assigneeId: member.userId, completedAt: { gte: week }, ...teamProject } }),
    prisma.task.findMany({ where: { assigneeId: member.userId, status: { notIn: ["ACCEPTED", "DONE"] }, ...teamProject }, select: { id: true, code: true, title: true, status: true, priority: true, dueAt: true, project: { select: { name: true } } }, orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }], take: 10 }),
    prisma.task.count({ where: { acceptorId: member.userId, status: "PENDING_ACCEPTANCE", ...teamProject } }),
    prisma.tokenUsageDaily.findMany({ where: { userId: member.userId }, select: { date: true, tool: true, model: true, inputTokens: true, outputTokens: true, cacheTokens: true, reasoningTokens: true, sessions: true, estimatedCost: true }, orderBy: { date: "asc" } }),
    prisma.usageCollectorDevice.findMany({ where: { userId: member.userId }, select: { id: true, name: true, platform: true, clientVersion: true, lastSeenAt: true, lastStatus: true, lastError: true, revokedAt: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const closed = requirements.filter((item) => item.status === "DONE");
  const durations = closed.flatMap((item) => item.closedAt ? [item.closedAt.getTime() - item.createdAt.getTime()] : []);
  const averageRequirementHours = durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length / 3_600_000) : null;
  const inRange = (start: Date) => usageRows.filter((row) => row.date >= start);
  const details = usageRows.filter((row) => row.date >= detailStart);
  return NextResponse.json({
    contribution: { requirementsProposed: requirements.length, requirementsClosed: closed.length, averageRequirementHours, weeklyCompletedTasks: weeklyCompleted, pendingAcceptance, currentTasks },
    usage: {
      today: sumUsage(inRange(today)), week: sumUsage(inRange(week)), month: sumUsage(inRange(month)), all: sumUsage(usageRows),
      scopeLabel: "个人全部 AI 工具用量，非当前团队独占消耗",
      details: canViewDetails ? details.map((row) => ({ ...row, inputTokens: bigintNumber(row.inputTokens), outputTokens: bigintNumber(row.outputTokens), cacheTokens: bigintNumber(row.cacheTokens), reasoningTokens: bigintNumber(row.reasoningTokens), estimatedCost: row.estimatedCost?.toString() || null })) : null,
      devices: canViewDetails ? devices : devices.filter((device) => !device.revokedAt).map((device) => ({ lastSeenAt: device.lastSeenAt, lastStatus: device.lastStatus })),
    },
    permissions: { canViewUsageDetails: canViewDetails },
  });
}
