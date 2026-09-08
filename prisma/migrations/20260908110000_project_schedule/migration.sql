ALTER TABLE "Requirement"
ADD COLUMN "plannedStartAt" TIMESTAMP(3),
ADD COLUMN "dueAt" TIMESTAMP(3),
ADD COLUMN "startedAt" TIMESTAMP(3);

ALTER TABLE "Task"
ADD COLUMN "plannedStartAt" TIMESTAMP(3),
ADD COLUMN "startedAt" TIMESTAMP(3);

CREATE INDEX "Requirement_projectId_plannedStartAt_idx" ON "Requirement"("projectId", "plannedStartAt");
CREATE INDEX "Requirement_projectId_dueAt_idx" ON "Requirement"("projectId", "dueAt");
CREATE INDEX "Task_projectId_plannedStartAt_idx" ON "Task"("projectId", "plannedStartAt");
CREATE INDEX "Task_projectId_dueAt_idx" ON "Task"("projectId", "dueAt");
