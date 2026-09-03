import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUserId, isRateLimited } from "@/lib/team-permissions";
import { getProjectAccess } from "@/lib/project-permissions";

async function memberContext(request: NextRequest, projectId: string, memberId: string) {
  const userId = await getRequestUserId(request);
  if (!userId) return { error: NextResponse.json({ error: "请先登录" }, { status: 401 }) };
  const [access, target] = await Promise.all([
    getProjectAccess(projectId, userId),
    prisma.projectMember.findFirst({ where: { id: memberId, projectId } }),
  ]);
  if (!access?.canManage || !target) return { error: NextResponse.json({ error: "成员不存在或无权操作" }, { status: 403 }) };
  if (!access.canAssignManagers && (target.role === "OWNER" || target.role === "MANAGER")) return { error: NextResponse.json({ error: "项目经理不能操作项目所有者或其他经理" }, { status: 403 }) };
  return { userId, access, target };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ projectId: string; memberId: string }> }) {
  const { projectId, memberId } = await params;
  const context = await memberContext(request, projectId, memberId);
  if ("error" in context) return context.error;
  const input = z.object({ role: z.enum(["OWNER", "MANAGER", "MEMBER", "GUEST"]), responsibility: z.string().trim().max(120).nullable().optional() }).safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: "项目角色或职责不正确" }, { status: 400 });
  if ((input.data.role === "OWNER" || input.data.role === "MANAGER") && !context.access.canAssignManagers) return NextResponse.json({ error: "没有设置项目管理角色的权限" }, { status: 403 });
  if (context.target.role === "OWNER" && input.data.role !== "OWNER" && await prisma.projectMember.count({ where: { projectId, role: "OWNER" } }) <= 1) return NextResponse.json({ error: "项目必须至少保留一位所有者" }, { status: 409 });
  if (await isRateLimited(context.userId, "UPDATE_PROJECT_MEMBER", 20)) return NextResponse.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
  const member = await prisma.$transaction(async (tx) => {
    const updated = await tx.projectMember.update({ where: { id: memberId }, data: { role: input.data.role, responsibility: input.data.responsibility === undefined ? context.target.responsibility : input.data.responsibility || null } });
    await tx.auditLog.create({ data: { userId: context.userId, projectId, actorType: "USER", action: "UPDATE_PROJECT_MEMBER", resource: "PROJECT_MEMBER", resourceId: memberId, channel: "WEB", metadata: { projectId, fromRole: context.target.role, toRole: input.data.role } } });
    return updated;
  });
  return NextResponse.json({ member });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ projectId: string; memberId: string }> }) {
  const { projectId, memberId } = await params;
  const context = await memberContext(request, projectId, memberId);
  if ("error" in context) return context.error;
  if (context.target.role === "OWNER" && await prisma.projectMember.count({ where: { projectId, role: "OWNER" } }) <= 1) return NextResponse.json({ error: "不能移除项目最后一位所有者" }, { status: 409 });
  if (await isRateLimited(context.userId, "REMOVE_PROJECT_MEMBER", 20)) return NextResponse.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
  await prisma.$transaction(async (tx) => {
    await tx.projectMember.delete({ where: { id: memberId } });
    await tx.auditLog.create({ data: { userId: context.userId, projectId, actorType: "USER", action: "REMOVE_PROJECT_MEMBER", resource: "PROJECT_MEMBER", resourceId: memberId, channel: "WEB", metadata: { projectId, removedUserId: context.target.userId, role: context.target.role } } });
  });
  return NextResponse.json({ ok: true });
}
