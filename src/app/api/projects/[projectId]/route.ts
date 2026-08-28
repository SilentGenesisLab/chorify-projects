import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUserId, isRateLimited } from "@/lib/team-permissions";
import { getProjectAccess } from "@/lib/project-permissions";
import { deleteObject } from "@/lib/object-storage";

const schema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(300),
  background: z.string().max(20_000).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]),
  startDate: z.string().datetime().nullable(),
  endDate: z.string().datetime().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const userId = await getRequestUserId(request);
  const { projectId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const access = await getProjectAccess(projectId, userId);
  if (!access?.canManage)
    return NextResponse.json({ error: "只有项目经理或所有者可以编辑项目资料" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "项目信息不完整" },
      { status: 400 },
    );
  const startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : null;
  const endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null;
  if (startDate && endDate && endDate < startDate)
    return NextResponse.json({ error: "项目结束日期不能早于开始日期" }, { status: 400 });
  const project = await prisma.$transaction(async (tx) => {
    const updated = await tx.project.update({
      where: { id: projectId },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        description: parsed.data.description,
        ...(parsed.data.background !== undefined ? { background: parsed.data.background } : {}),
        status: parsed.data.status,
        startDate,
        endDate,
      },
    });
    await tx.auditLog.create({
      data: {
        userId,
        actorType: "USER",
        action: "UPDATE_PROJECT_PROFILE",
        resource: "PROJECT",
        resourceId: projectId,
        channel: "WEB",
        metadata: { projectId, result: "SUCCESS" },
      },
    });
    return updated;
  });
  return NextResponse.json({ project });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const userId = await getRequestUserId(request);
  const { projectId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const access = await getProjectAccess(projectId, userId);
  const canDelete = Boolean(
    access?.projectMember?.role === "OWNER" ||
    access?.teamMember?.role === "OWNER" ||
    access?.teamMember?.role === "ADMIN",
  );
  if (!canDelete)
    return NextResponse.json({ error: "只有项目所有者或团队管理员可以删除项目" }, { status: 403 });
  if (await isRateLimited(userId, "DELETE_PROJECT", 5))
    return NextResponse.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
  const parsed = z.object({ confirmName: z.string() }).safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: "请输入项目名称确认删除" }, { status: 400 });
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      code: true,
      teamId: true,
      files: { select: { versions: { select: { objectKey: true } } } },
    },
  });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  if (parsed.data.confirmName !== project.name)
    return NextResponse.json({ error: "项目名称不匹配" }, { status: 400 });
  const objectKeys = project.files.flatMap((file) => file.versions.map((version) => version.objectKey));
  try {
    await prisma.$transaction([
      prisma.project.delete({ where: { id: projectId } }),
      prisma.auditLog.create({
        data: {
          userId,
          actorType: "USER",
          action: "DELETE_PROJECT",
          resource: "PROJECT",
          resourceId: projectId,
          channel: "WEB",
          metadata: { teamId: project.teamId, code: project.code, projectName: project.name, result: "SUCCESS" },
        },
      }),
    ]);
  } catch {
    return NextResponse.json({ error: "项目仍有关联数据，暂时无法删除" }, { status: 409 });
  }
  await Promise.all(objectKeys.map((objectKey) => deleteObject(objectKey).catch(() => undefined)));
  return NextResponse.json({ ok: true });
}
