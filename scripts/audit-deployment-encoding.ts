import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const suspicious = /\uFFFD|(?:Ã.|Â.|â€|ðŸ|锟斤拷)/u;
const findings: Array<{ model: string; id: string; field: string; value: string }> = [];

function scan(model: string, rows: Array<Record<string, unknown>>, fields: string[]) {
  for (const row of rows) {
    for (const field of fields) {
      const value = row[field];
      if (typeof value === "string" && suspicious.test(value)) findings.push({ model, id: String(row.id), field, value });
    }
  }
}

async function main() {
  const [repositories, services, environments, runs, steps, releases] = await Promise.all([
    prisma.projectRepository.findMany(),
    prisma.deployableService.findMany(),
    prisma.deploymentEnvironment.findMany(),
    prisma.deploymentRun.findMany(),
    prisma.deploymentStep.findMany(),
    prisma.release.findMany(),
  ]);
  scan("ProjectRepository", repositories, ["owner", "name", "fullName", "defaultBranch", "workflowPath", "lastError"]);
  scan("DeployableService", services, ["name", "slug", "dockerfilePath", "buildContext", "healthPath"]);
  scan("DeploymentEnvironment", environments, ["name", "slug", "url", "githubEnvironment", "healthPath"]);
  scan("DeploymentRun", runs, ["failureReason"]);
  scan("DeploymentStep", steps, ["name", "output"]);
  scan("Release", releases, ["environment", "notes"]);
  if (findings.length) {
    console.error(JSON.stringify({ ok: false, count: findings.length, findings }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ ok: true, count: 0 }, null, 2));
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
