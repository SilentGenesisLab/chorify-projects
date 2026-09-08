import { PrismaClient } from "@prisma/client";
import { resolveCommit } from "../src/lib/github-app";

const prisma = new PrismaClient();

async function main() {
  const artifacts = await prisma.buildArtifact.findMany({
    where: { commitMessage: null },
    include: { service: { include: { repository: true } } },
  });
  const cache = new Map<string, Awaited<ReturnType<typeof resolveCommit>>>();
  let updated = 0;
  let failed = 0;

  for (const artifact of artifacts) {
    const repository = artifact.service.repository;
    const key = `${repository.id}:${artifact.commitSha.toLowerCase()}`;
    try {
      let commit = cache.get(key);
      if (!commit) {
        commit = await resolveCommit(repository.owner, repository.name, repository.installationId, artifact.commitSha);
        cache.set(key, commit);
      }
      const data = {
        commitMessage: commit.commit.message,
        commitAuthor: commit.commit.author.name,
        commitCommittedAt: new Date(commit.commit.author.date),
        commitUrl: commit.html_url,
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
