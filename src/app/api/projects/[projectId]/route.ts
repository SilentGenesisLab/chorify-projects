import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUserId } from "@/lib/team-permissions";
import { getProjectAccess } from "@/lib/project-permissions";

const schema = z.object({
  description: z.string().trim().max(300),
  background: z.string().max(20_000),
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
        description: parsed.data.description,
        background: parsed.data.background,
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
        metadata: { result: "SUCCESS" },
      },
    });
    return updated;
  });
  return NextResponse.json({ project });
}
