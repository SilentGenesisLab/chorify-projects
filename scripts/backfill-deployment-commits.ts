import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { resolveCommit } from "../src/lib/github-app";

const prisma = new PrismaClient();

async function commitDetails(repository: { owner: string; name: string; installationId: string }, sha: string) {
  try {
    const commit = await resolveCommit(repository.owner, repository.name, repository.installationId, sha);
    return { message: commit.commit.message, author: commit.commit.author.name, date: commit.commit.author.date, url: commit.html_url };
  } catch (error) {
    if (process.env.BACKFILL_LOCAL_GIT !== "true") throw error;
    const [author, date, ...message] = execFileSync("git", ["show", "-s", "--format=%an%x00%aI%x00%B", sha], { encoding: "utf8" }).split("\0");
    return { message: message.join("\0").trim(), author, date, url: `https://github.com/${repository.owner}/${repository.name}/commit/${sha}` };
  }
}

async function main() {
  const artifacts = await prisma.buildArtifact.findMany({
    where: { commitMessage: null },
    include: { service: { include: { repository: true } } },
  });
  const cache = new Map<string, Awaited<ReturnType<typeof commitDetails>>>();
  let updated = 0;
  let failed = 0;

  for (const artifact of artifacts) {
    const repository = artifact.service.repository;
    const key = `${repository.id}:${artifact.commitSha.toLowerCase()}`;
    try {
      let commit = cache.get(key);
      if (!commit) {
        commit = await commitDetails(repository, artifact.commitSha);
        cache.set(key, commit);
      }
      const data = {
        commitMessage: commit.message,
        commitAuthor: commit.author,
        commitCommittedAt: new Date(commit.date),
        commitUrl: commit.url,
      };
      await prisma.$transaction([
        prisma.buildArtifact.update({ where: { id: artifact.id }, data }),
        prisma.versionComponent.updateMany({ where: { id: artifact.versionComponentId, commitSha: artifact.commitSha }, data }),
      ]);
      updated += 1;
    } catch (error) {
      failed += 1;
      console.error(`${repository.fullName}@${artifact.commitSha.slice(0, 8)}: ${error instanceof Error ? error.message : "读取失败"}`);
    }
  }
  console.log(JSON.stringify({ scanned: artifacts.length, updated, failed }));
  if (failed) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
