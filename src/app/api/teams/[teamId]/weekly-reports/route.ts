import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { teamAccess } from "@/lib/team-api";
import { isTeamManager } from "@/lib/team-permissions";
import { weekRange } from "@/lib/weekly-report";

const author = { select: { id: true, name: true, avatarColor: true } } as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const access = await teamAccess(request, teamId);
  if ("error" in access) return access.error;
  if (access.membership.role === "GUEST")
    return NextResponse.json({ error: "访客不能查看团队周报" }, { status: 403 });
  const range = weekRange(request.nextUrl.searchParams.get("weekStart") || undefined);
  if (!range) return NextResponse.json({ error: "周报周期无效" }, { status: 400 });
  const canManage = isTeamManager(access.membership.role);
  const requestedMember = request.nextUrl.searchParams.get("memberId") || "";
  const memberId = canManage
    ? requestedMember === "me" ? access.userId : requestedMember
    : access.userId;
  const members = await prisma.teamMember.findMany({
    where: { teamId, role: { not: "GUEST" } },
    include: { user: { select: { id: true, name: true, avatarColor: true } } },
    orderBy: { user: { name: "asc" } },
  });
  if (memberId && !members.some((item) => item.userId === memberId))
    return NextResponse.json({ error: "成员不属于当前团队" }, { status: 400 });
  const [reports, myReport] = await Promise.all([
    prisma.teamWeeklyReport.findMany({
      where: {
        teamId,
        weekStart: range.start,
        ...(memberId ? { authorId: memberId } : {}),
        ...(!memberId || memberId !== access.userId ? { status: "SUBMITTED" } : {}),
      },
      include: { author },
      orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.teamWeeklyReport.findUnique({
      where: { teamId_authorId_weekStart: { teamId, authorId: access.userId, weekStart: range.start } },
      include: { author },
    }),
  ]);
  const submittedIds = new Set(
    reports.filter((item) => item.status === "SUBMITTED").map((item) => item.authorId),
  );
  return NextResponse.json({
    week: { start: range.start, end: range.end, startLabel: range.startLabel },
    viewerId: access.userId,
    canManage,
    members: members.map((item) => ({
      id: item.user.id,
      name: item.user.name,
      avatarColor: item.user.avatarColor,
    })),
    reports,
    myReport,
    summary: {
      submitted: submittedIds.size,
      expected: memberId ? 1 : members.length,
      missing: Math.max(0, (memberId ? 1 : members.length) - submittedIds.size),
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const access = await teamAccess(request, teamId);
  if ("error" in access) return access.error;
  if (access.membership.role === "GUEST")
    return NextResponse.json({ error: "访客不能提交团队周报" }, { status: 403 });
  const parsed = z.object({
    weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    content: z.string().max(50_000),
    action: z.enum(["DRAFT", "SUBMIT"]),
  }).safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: "周报信息不完整" }, { status: 400 });
  const range = weekRange(parsed.data.weekStart);
  if (!range) return NextResponse.json({ error: "周报周期无效" }, { status: 400 });
  if (parsed.data.action === "SUBMIT" && parsed.data.content.trim().length < 10)
    return NextResponse.json({ error: "正式提交前请完善周报内容" }, { status: 400 });
  const status = parsed.data.action === "SUBMIT" ? "SUBMITTED" : "DRAFT";
  const report = await prisma.$transaction(async (tx) => {
    const saved = await tx.teamWeeklyReport.upsert({
      where: {
        teamId_authorId_weekStart: {
          teamId,
          authorId: access.userId,
          weekStart: range.start,
        },
      },
      create: {
        teamId,
        authorId: access.userId,
        weekStart: range.start,
        weekEnd: range.end,
        content: parsed.data.content,
        status,
        submittedAt: status === "SUBMITTED" ? new Date() : null,
      },
      update: {
        content: parsed.data.content,
        status,
        submittedAt: status === "SUBMITTED" ? new Date() : null,
      },
      include: { author },
    });
    await tx.auditLog.create({
      data: {
        userId: access.userId,
        actorType: "USER",
        action: status === "SUBMITTED" ? "SUBMIT_WEEKLY_REPORT" : "SAVE_WEEKLY_REPORT_DRAFT",
        resource: "TEAM_WEEKLY_REPORT",
        resourceId: saved.id,
        channel: "WEB",
        metadata: { teamId, weekStart: range.startLabel },
      },
    });
    return saved;
  });
  return NextResponse.json({ report }, { status: 200 });
}
