import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildProjectActivityMetrics, projectWeek, toJsonMetrics } from "@/lib/project-activity";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "未授权" }, { status: 401 });
  const current = projectWeek();
  const previous = projectWeek(new Date(current.start.getTime() - 86_400_000));
  const projects = await prisma.project.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true } });
  let finalized = 0;
  for (const project of projects) {
    const existing = await prisma.projectWeeklyReview.findUnique({ where: { projectId_weekStart: { projectId: project.id, weekStart: previous.start } } });
    if (existing?.finalizedAt) continue;
    const metrics = await buildProjectActivityMetrics(project.id, previous.start, previous.end, previous.end);
    await prisma.projectWeeklyReview.upsert({
      where: { projectId_weekStart: { projectId: project.id, weekStart: previous.start } },
      create: { projectId: project.id, weekStart: previous.start, weekEnd: previous.end, metrics: toJsonMetrics(metrics), finalizedAt: new Date() },
      update: { weekEnd: previous.end, metrics: toJsonMetrics(metrics), finalizedAt: new Date() },
    });
    finalized++;
  }
  return NextResponse.json({ week: previous.key, projects: projects.length, finalized });
}
