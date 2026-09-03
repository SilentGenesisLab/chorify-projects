import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUserId } from "@/lib/team-permissions";
import { getProjectAccess } from "@/lib/project-permissions";
import { buildProjectActivityMetrics, projectWeek, toJsonMetrics } from "@/lib/project-activity";

export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const userId = await getRequestUserId(request);
  const { projectId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const access = await getProjectAccess(projectId, userId);
  if (!access?.canAccess) return NextResponse.json({ error: "无权访问该项目" }, { status: 403 });

  let selected;
  try { selected = projectWeek(request.nextUrl.searchParams.get("week") || new Date()); }
  catch { return NextResponse.json({ error: "week 必须是 YYYY-MM-DD 日期" }, { status: 400 }); }
  const current = projectWeek();
  if (selected.start >= current.end) return NextResponse.json({ error: "不能查看未来周" }, { status: 400 });

  let review = await prisma.projectWeeklyReview.findUnique({
    where: { projectId_weekStart: { projectId, weekStart: selected.start } },
    include: { lastEditor: { select: { id: true, name: true } } },
  });
  const metrics = review?.finalizedAt && review.metrics ? review.metrics : await buildProjectActivityMetrics(projectId, selected.start, selected.end, selected.end <= new Date() ? selected.end : new Date());
  if (!review) {
    review = await prisma.projectWeeklyReview.create({
      data: {
        projectId,
        weekStart: selected.start,
        weekEnd: selected.end,
        ...(selected.end <= new Date() ? { metrics: toJsonMetrics(metrics as Awaited<ReturnType<typeof buildProjectActivityMetrics>>), finalizedAt: new Date() } : {}),
      },
      include: { lastEditor: { select: { id: true, name: true } } },
    });
  } else if (!review.finalizedAt && selected.end <= new Date()) {
    review = await prisma.projectWeeklyReview.update({
      where: { id: review.id },
      data: { metrics: toJsonMetrics(metrics as Awaited<ReturnType<typeof buildProjectActivityMetrics>>), finalizedAt: new Date() },
      include: { lastEditor: { select: { id: true, name: true } } },
    });
  }

  const [strategies, project] = await Promise.all([
    prisma.projectStrategyChange.findMany({
      where: { projectId, effectiveAt: { gte: selected.start, lt: selected.end } },
      include: { decider: { select: { id: true, name: true, avatarColor: true } }, createdBy: { select: { id: true, name: true } } },
      orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { id: true, name: true, createdAt: true, members: { include: { user: { select: { id: true, name: true, avatarColor: true } } }, orderBy: { user: { name: "asc" } } } },
    }),
  ]);

  return NextResponse.json({
    project: { id: project.id, name: project.name, createdAt: project.createdAt },
    week: { key: selected.key, start: selected.start, end: selected.end, current: selected.key === current.key, finalized: Boolean(review.finalizedAt) },
    permissions: { canManage: access.canManage },
    members: project.members.map((item) => ({ id: item.userId, name: item.user.name, avatarColor: item.user.avatarColor })),
    review,
    metrics,
    strategies,
  });
}
