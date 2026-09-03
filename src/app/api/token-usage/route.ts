import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProjectAccess } from "@/lib/project-permissions";
import { getRequestUserId } from "@/lib/team-permissions";
import { bigintNumber } from "@/lib/usage-collector";

export async function GET(request: NextRequest) {
  const viewerId = await getRequestUserId(request);
  if (!viewerId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const memberId = request.nextUrl.searchParams.get("memberId");
  const projectId = request.nextUrl.searchParams.get("projectId");
  let targetUserId = viewerId;
  let canViewDetails = true;
  if (memberId) {
    if (!projectId) return NextResponse.json({ error: "查看其他成员时必须提供项目" }, { status: 400 });
    const [access, member] = await Promise.all([getProjectAccess(projectId, viewerId), prisma.projectMember.findFirst({ where: { id: memberId, projectId }, select: { userId: true } })]);
    if (!access?.canAccess || !member) return NextResponse.json({ error: "成员不存在或无权访问" }, { status: 403 });
    targetUserId = member.userId;
    canViewDetails = Boolean(access.canManage || targetUserId === viewerId);
  }
  const days = Number(request.nextUrl.searchParams.get("range") || 30);
  const start = Number.isFinite(days) && days > 0 && days <= 365 ? new Date(Date.now() - (days - 1) * 86_400_000) : undefined;
  if (start) start.setUTCHours(0, 0, 0, 0);
  const rows = await prisma.tokenUsageDaily.findMany({ where: { userId: targetUserId, ...(start ? { date: { gte: start } } : {}) }, orderBy: { date: "asc" } });
  const daily = new Map<string, { date: string; input: bigint; output: bigint; cache: bigint; reasoning: bigint }>();
  const tools = new Map<string, bigint>();
  for (const row of rows) {
    const key = row.date.toISOString().slice(0, 10);
    const day = daily.get(key) || { date: key, input: BigInt(0), output: BigInt(0), cache: BigInt(0), reasoning: BigInt(0) };
    day.input += row.inputTokens; day.output += row.outputTokens; day.cache += row.cacheTokens; day.reasoning += row.reasoningTokens;
    daily.set(key, day);
    tools.set(row.tool, (tools.get(row.tool) || BigInt(0)) + row.inputTokens + row.outputTokens + row.cacheTokens + row.reasoningTokens);
  }
  return NextResponse.json({
    scopeLabel: "个人全部 AI 工具用量，非当前项目独占消耗",
    daily: [...daily.values()].map((day) => ({ date: day.date, inputTokens: bigintNumber(day.input), outputTokens: bigintNumber(day.output), cacheTokens: bigintNumber(day.cache), reasoningTokens: bigintNumber(day.reasoning), totalTokens: bigintNumber(day.input + day.output + day.cache + day.reasoning) })),
    tools: [...tools].map(([tool, total]) => ({ tool, totalTokens: bigintNumber(total) })),
    details: canViewDetails ? rows.map((row) => ({ id: row.id, date: row.date, tool: row.tool, model: row.model, inputTokens: bigintNumber(row.inputTokens), outputTokens: bigintNumber(row.outputTokens), cacheTokens: bigintNumber(row.cacheTokens), reasoningTokens: bigintNumber(row.reasoningTokens), sessions: row.sessions, estimatedCost: row.estimatedCost?.toString() || null })) : null,
  });
}
