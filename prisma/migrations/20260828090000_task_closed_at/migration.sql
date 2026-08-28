ALTER TABLE "Task" ADD COLUMN "closedAt" TIMESTAMP(3);
UPDATE "Task" SET "closedAt" = COALESCE("completedAt", "updatedAt") WHERE "status" = 'DONE';
UPDATE "Team" SET "mission" = '让团队在统一项目上下文中清晰协作、可靠交付。', "responsibilities" = '项目规划、协作推进、质量验收与版本交付' WHERE "mission" IS NULL;
CREATE INDEX "Task_projectId_closedAt_idx" ON "Task"("projectId", "closedAt");
