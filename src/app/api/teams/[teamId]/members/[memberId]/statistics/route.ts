import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bigintNumber } from "@/lib/usage-collector";
import { getRequestUserId, getTeamMembership, isTeamManager } from "@/lib/team-permissions";
import { canViewUsageDetails } from "@/lib/usage-analytics";
import { z } from "zod";

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

function sumUsage(rows: Array<{ inputTokens: bigint; outputTokens: bigint; cacheTokens: bigint; reasoningTokens: bigint; sessions: number; activeSeconds: number }>) {
  const total = rows.reduce((sum, row) => ({
    input: sum.input + row.inputTokens,
    output: sum.output + row.outputTokens,
    cache: sum.cache + row.cacheTokens,
    reasoning: sum.reasoning + row.reasoningTokens,
    sessions: sum.sessions + row.sessions,
    activeSeconds: sum.activeSeconds + row.activeSeconds,
  }), { input: BigInt(0), output: BigInt(0), cache: BigInt(0), reasoning: BigInt(0), sessions: 0, activeSeconds: 0 });
  return {
    inputTokens: bigintNumber(total.input), outputTokens: bigintNumber(total.output), cacheTokens: bigintNumber(total.cache),
    reasoningTokens: bigintNumber(total.reasoning), totalTokens: bigintNumber(total.input + total.output + total.cache + total.reasoning), sessions: total.sessions, activeSeconds: total.activeSeconds, averageWorkerSeconds: total.sessions ? Math.round(total.activeSeconds / total.sessions) : 0,
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ teamId: string; memberId: string }> }) {
  const viewerId = await getRequestUserId(request);
  if (!viewerId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { teamId, memberId } = await params;
  const [viewer, member] = await Promise.all([
    getTeamMembership(teamId, viewerId),
    prisma.teamMember.findFirst({ where: { id: memberId, teamId }, select: { userId: true, role: true, aiUsageVisibility: true } }),
  ]);
  if (!viewer || !member) return NextResponse.json({ error: "成员不存在或无权访问" }, { status: 403 });
  if (viewer.role === "GUEST") return NextResponse.json({ error: "访客不可查看团队成员统计" }, { status: 403 });

  const today = shanghaiBoundary("today"), week = shanghaiBoundary("week"), month = shanghaiBoundary("month");
  const detailStart = new Date(today); detailStart.setUTCMonth(detailStart.getUTCMonth() - 12);
  const canViewDetails = canViewUsageDetails(viewerId, member.userId, viewer.role, member.aiUsageVisibility);
  const canViewSummary = isTeamManager(viewer.role) || canViewDetails;
  const teamProject = { project: { teamId } };
  const [requirements, weeklyCompleted, currentTasks, pendingAcceptance, usageRows, devices] = await Promise.all([
    prisma.requirement.findMany({ where: { requesterId: member.userId, ...teamProject }, select: { status: true, createdAt: true, closedAt: true } }),
    prisma.task.count({ where: { assigneeId: member.userId, completedAt: { gte: week }, ...teamProject } }),
    prisma.task.findMany({ where: { assigneeId: member.userId, status: { notIn: ["ACCEPTED", "DONE"] }, ...teamProject }, select: { id: true, code: true, title: true, status: true, priority: true, dueAt: true, project: { select: { name: true } } }, orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }], take: 10 }),
    prisma.task.count({ where: { acceptorId: member.userId, status: "PENDING_ACCEPTANCE", ...teamProject } }),
    prisma.tokenUsageDaily.findMany({ where: { userId: member.userId }, select: { date: true, tool: true, model: true, inputTokens: true, outputTokens: true, cacheTokens: true, reasoningTokens: true, sessions: true, activeSeconds: true, estimatedCost: true }, orderBy: { date: "asc" } }),
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
      visibility: member.aiUsageVisibility,
      hidden: !canViewSummary,
      details: canViewDetails ? details.map((row) => ({ ...row, inputTokens: bigintNumber(row.inputTokens), outputTokens: bigintNumber(row.outputTokens), cacheTokens: bigintNumber(row.cacheTokens), reasoningTokens: bigintNumber(row.reasoningTokens), estimatedCost: row.estimatedCost?.toString() || null })) : null,
      devices: canViewDetails ? devices : devices.filter((device) => !device.revokedAt).map((device) => ({ lastSeenAt: device.lastSeenAt, lastStatus: device.lastStatus })),
    },
    permissions: { canViewUsageDetails: canViewDetails, canEditUsageVisibility: viewerId === member.userId },
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ teamId: string; memberId: string }> }) {
  const viewerId = await getRequestUserId(request);
  if (!viewerId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { teamId, memberId } = await params;
  const member = await prisma.teamMember.findFirst({ where: { id: memberId, teamId, userId: viewerId } });
  if (!member || member.role === "GUEST") return NextResponse.json({ error: "只能设置自己的团队 AI 用量可见范围" }, { status: 403 });
  const input = z.object({ visibility: z.enum(["SELF", "MANAGERS", "TEAM"]) }).safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: "可见范围不正确" }, { status: 400 });
  await prisma.$transaction([
    prisma.teamMember.update({ where: { id: member.id }, data: { aiUsageVisibility: input.data.visibility } }),
    prisma.auditLog.create({ data: { userId: viewerId, actorType: "USER", action: "UPDATE_AI_USAGE_VISIBILITY", resource: "TEAM_MEMBER", resourceId: member.id, channel: "WEB", metadata: { teamId, visibility: input.data.visibility } } }),
  ]);
  return NextResponse.json({ visibility: input.data.visibility });
}
