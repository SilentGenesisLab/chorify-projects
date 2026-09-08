CREATE TYPE "DeploymentNotificationType" AS ENUM ('DEPLOYMENT_FAILED', 'AUTO_ROLLBACK', 'ENVIRONMENT_DOWN', 'ENVIRONMENT_RECOVERED', 'DEPLOYMENT_SUCCEEDED', 'TEST');
CREATE TYPE "DeploymentNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

ALTER TABLE "ProjectRepository" ADD COLUMN "lastError" TEXT;
ALTER TABLE "DeploymentRun" ADD COLUMN "failureStepKey" TEXT;
ALTER TABLE "DeploymentRun" ADD COLUMN "failureDetails" JSONB;

CREATE TABLE "ProjectDeploymentSettings" (
  "projectId" TEXT NOT NULL,
  "guideMarkdown" TEXT NOT NULL DEFAULT '',
  "feishuWebhookEncrypted" TEXT,
  "feishuSecretEncrypted" TEXT,
  "feishuEnabled" BOOLEAN NOT NULL DEFAULT false,
  "notifyDeploymentSucceeded" BOOLEAN NOT NULL DEFAULT false,
  "feishuLastTestedAt" TIMESTAMP(3),
  "feishuLastTestStatus" TEXT,
  "feishuLastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectDeploymentSettings_pkey" PRIMARY KEY ("projectId")
);

CREATE TABLE "DeploymentNotificationDelivery" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "environmentId" TEXT,
  "deploymentRunId" TEXT,
  "eventKey" TEXT NOT NULL,
  "type" "DeploymentNotificationType" NOT NULL,
  "status" "DeploymentNotificationStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeploymentNotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeploymentNotificationDelivery_eventKey_key" ON "DeploymentNotificationDelivery"("eventKey");
CREATE INDEX "DeploymentNotificationDelivery_status_nextAttemptAt_idx" ON "DeploymentNotificationDelivery"("status", "nextAttemptAt");
CREATE INDEX "DeploymentNotificationDelivery_projectId_createdAt_idx" ON "DeploymentNotificationDelivery"("projectId", "createdAt");

ALTER TABLE "ProjectDeploymentSettings" ADD CONSTRAINT "ProjectDeploymentSettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeploymentNotificationDelivery" ADD CONSTRAINT "DeploymentNotificationDelivery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeploymentNotificationDelivery" ADD CONSTRAINT "DeploymentNotificationDelivery_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "DeploymentEnvironment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeploymentNotificationDelivery" ADD CONSTRAINT "DeploymentNotificationDelivery_deploymentRunId_fkey" FOREIGN KEY ("deploymentRunId") REFERENCES "DeploymentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The affected values already contain replacement characters, so they cannot be
-- transcoded back. Recover system-owned labels from their canonical enum/slug.
UPDATE "DeploymentEnvironment"
SET "name" = CASE WHEN "kind" = 'PRODUCTION' THEN '生产' ELSE '预发布' END
WHERE POSITION(U&'\FFFD' IN "name") > 0;

UPDATE "Release" AS release
SET "environment" = environment."name"
FROM "DeploymentRun" AS run
JOIN "DeploymentEnvironment" AS environment ON environment."id" = run."environmentId"
WHERE release."deploymentRunId" = run."id"
  AND POSITION(U&'\FFFD' IN release."environment") > 0;

-- Reconcile the known 2026-09-08 failure from the public GitHub job record.
UPDATE "DeploymentRun"
SET "failureStepKey" = 'dependencies',
    "failureReason" = '安装依赖失败（exit code 152）',
    "failureDetails" = '{"githubStep":"Install dependencies","exitCode":152,"annotation":"Process completed with exit code 152."}'::jsonb
WHERE "githubRunId" = '34209129583' AND "status" = 'FAILED';

UPDATE "DeploymentStep"
SET "status" = 'SUCCEEDED', "finishedAt" = COALESCE("finishedAt", "startedAt")
WHERE "deploymentRunId" IN (SELECT "id" FROM "DeploymentRun" WHERE "githubRunId" = '34209129583')
  AND "key" = 'checkout';

INSERT INTO "DeploymentStep" ("id", "deploymentRunId", "key", "name", "sortOrder", "status", "logsUrl", "output", "startedAt", "finishedAt")
SELECT 'reconciled_dependencies_' || run."id", run."id", 'dependencies', '安装依赖', 1, 'FAILED', run."githubRunUrl",
       '{"githubStep":"Install dependencies","exitCode":152,"annotation":"Process completed with exit code 152."}'::jsonb,
       run."startedAt", run."finishedAt"
FROM "DeploymentRun" AS run
WHERE run."githubRunId" = '34209129583'
ON CONFLICT ("deploymentRunId", "key") DO NOTHING;
