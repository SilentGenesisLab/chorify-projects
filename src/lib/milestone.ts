import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const milestoneSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2_000).default(""),
  ownerId: z.string().cuid().nullable().optional(),
  versionId: z.string().cuid().nullable().optional(),
  dueAt: z.string().datetime(),
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "DELAYED", "CANCELLED"]),
});

export async function validateMilestoneRelations(
  projectId: string,
  ownerId?: string | null,
  versionId?: string | null,
) {
  const [member, version] = await Promise.all([
    ownerId
      ? prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId, userId: ownerId } },
          select: { id: true },
        })
      : null,
    versionId
      ? prisma.version.findFirst({ where: { id: versionId, projectId }, select: { id: true } })
      : null,
  ]);
  if (ownerId && !member) return "里程碑负责人必须是项目成员";
  if (versionId && !version) return "只能关联当前项目的版本";
  return null;
}
