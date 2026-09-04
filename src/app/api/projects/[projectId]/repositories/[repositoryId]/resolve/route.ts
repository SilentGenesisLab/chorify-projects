import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCommit } from "@/lib/github-app";
import { getProjectAccess } from "@/lib/project-permissions";
import { getRequestUserId } from "@/lib/team-permissions";

export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string; repositoryId: string }> }) {
  const userId = await getRequestUserId(request);
  const { projectId, repositoryId } = await params;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!(await getProjectAccess(projectId, userId))?.canManage) return NextResponse.json({ error: "只有项目管理员可以锁定代码版本" }, { status: 403 });
  const repository = await prisma.projectRepository.findFirst({ where: { id: repositoryId, projectId, status: "ACTIVE" } });
  if (!repository) return NextResponse.json({ error: "代码仓库不存在" }, { status: 404 });
  const ref = request.nextUrl.searchParams.get("ref") || repository.defaultBranch;
  try {
    const commit = await resolveCommit(repository.owner, repository.name, repository.installationId, ref);
    return NextResponse.json({ sha: commit.sha, url: commit.html_url, message: commit.commit.message, ref });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "无法读取 GitHub commit" }, { status: 502 });
  }
}
