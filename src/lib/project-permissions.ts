import type { ProjectRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  OWNER: "项目所有者",
  MANAGER: "项目经理",
  MEMBER: "项目成员",
  GUEST: "项目访客",
};

export async function getProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, teamId: true } });
  if (!project) return null;
  const [projectMember, teamMember] = await Promise.all([
    prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } }),
    prisma.teamMember.findUnique({ where: { teamId_userId: { teamId: project.teamId, userId } } }),
  ]);
  const teamManager = teamMember?.role === "OWNER" || teamMember?.role === "ADMIN";
  const projectManager = projectMember?.role === "OWNER" || projectMember?.role === "MANAGER";
  return {
    project,
    projectMember,
    teamMember,
    canAccess: Boolean(projectMember || teamManager),
    canManage: Boolean(projectManager || teamManager),
    canAssignManagers: Boolean(projectMember?.role === "OWNER" || teamManager),
  };
}
