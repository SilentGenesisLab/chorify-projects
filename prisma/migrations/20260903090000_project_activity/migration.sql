-- CreateEnum
CREATE TYPE "ProjectRiskStatus" AS ENUM ('OPEN', 'MITIGATING', 'RESOLVED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "StrategyChangeStatus" AS ENUM ('ACTIVE', 'VOID');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "firstCompletedAt" TIMESTAMP(3);
UPDATE "Task" SET "firstCompletedAt" = "completedAt" WHERE "completedAt" IS NOT NULL;

-- AlterTable
ALTER TABLE "Bug" ADD COLUMN "closedAt" TIMESTAMP(3);
UPDATE "Bug" SET "closedAt" = "updatedAt" WHERE "status" IN ('CLOSED', 'REJECTED');

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "projectId" TEXT;
UPDATE "AuditLog"
SET "projectId" = "metadata"->>'projectId'
WHERE "metadata" IS NOT NULL
  AND jsonb_typeof("metadata") = 'object'
  AND "metadata" ? 'projectId'
  AND EXISTS (SELECT 1 FROM "Project" WHERE "Project"."id" = "AuditLog"."metadata"->>'projectId');

-- CreateTable
CREATE TABLE "ProjectWeeklyReview" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "weekEnd" TIMESTAMP(3) NOT NULL,
  "metrics" JSONB,
  "summary" TEXT NOT NULL DEFAULT '',
  "nextFocus" TEXT NOT NULL DEFAULT '',
  "conclusion" TEXT NOT NULL DEFAULT '',
  "finalizedAt" TIMESTAMP(3),
  "lastEditorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectWeeklyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRisk" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "severity" "Priority" NOT NULL DEFAULT 'MEDIUM',
  "status" "ProjectRiskStatus" NOT NULL DEFAULT 'OPEN',
  "ownerId" TEXT,
  "mitigation" TEXT NOT NULL DEFAULT '',
  "dueAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectRisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectStrategyChange" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "before" TEXT NOT NULL,
  "after" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "impact" TEXT NOT NULL DEFAULT '',
  "details" TEXT NOT NULL DEFAULT '',
  "status" "StrategyChangeStatus" NOT NULL DEFAULT 'ACTIVE',
  "deciderId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "voidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectStrategyChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_projectId_firstCompletedAt_idx" ON "Task"("projectId", "firstCompletedAt");
CREATE INDEX "Bug_projectId_closedAt_idx" ON "Bug"("projectId", "closedAt");
CREATE UNIQUE INDEX "ProjectWeeklyReview_projectId_weekStart_key" ON "ProjectWeeklyReview"("projectId", "weekStart");
CREATE INDEX "ProjectWeeklyReview_projectId_weekStart_idx" ON "ProjectWeeklyReview"("projectId", "weekStart");
CREATE INDEX "ProjectRisk_projectId_status_createdAt_idx" ON "ProjectRisk"("projectId", "status", "createdAt");
CREATE INDEX "ProjectRisk_ownerId_idx" ON "ProjectRisk"("ownerId");
CREATE INDEX "ProjectStrategyChange_projectId_effectiveAt_idx" ON "ProjectStrategyChange"("projectId", "effectiveAt");
CREATE INDEX "ProjectStrategyChange_deciderId_idx" ON "ProjectStrategyChange"("deciderId");
CREATE INDEX "AuditLog_projectId_createdAt_idx" ON "AuditLog"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProjectWeeklyReview" ADD CONSTRAINT "ProjectWeeklyReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectWeeklyReview" ADD CONSTRAINT "ProjectWeeklyReview_lastEditorId_fkey" FOREIGN KEY ("lastEditorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectRisk" ADD CONSTRAINT "ProjectRisk_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectRisk" ADD CONSTRAINT "ProjectRisk_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectRisk" ADD CONSTRAINT "ProjectRisk_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectStrategyChange" ADD CONSTRAINT "ProjectStrategyChange_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectStrategyChange" ADD CONSTRAINT "ProjectStrategyChange_deciderId_fkey" FOREIGN KEY ("deciderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectStrategyChange" ADD CONSTRAINT "ProjectStrategyChange_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
