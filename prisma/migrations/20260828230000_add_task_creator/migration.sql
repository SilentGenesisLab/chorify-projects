ALTER TABLE "Task" ADD COLUMN "createdById" TEXT;

UPDATE "Task" AS task
SET "createdById" = source."userId"
FROM (
  SELECT DISTINCT ON ("resourceId") "resourceId", "userId"
  FROM "AuditLog"
  WHERE "action" = 'CREATE_TASK'
    AND "resource" = 'TASK'
    AND "userId" IS NOT NULL
    AND "resourceId" IS NOT NULL
  ORDER BY "resourceId", "createdAt" ASC
) AS source
WHERE task."id" = source."resourceId";

CREATE INDEX "Task_createdById_status_idx" ON "Task"("createdById", "status");
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
