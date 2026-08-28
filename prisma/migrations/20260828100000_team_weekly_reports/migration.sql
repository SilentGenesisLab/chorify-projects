CREATE TYPE "WeeklyReportStatus" AS ENUM ('DRAFT', 'SUBMITTED');

CREATE TABLE "TeamWeeklyReport" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "status" "WeeklyReportStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeamWeeklyReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamWeeklyReport_teamId_authorId_weekStart_key" ON "TeamWeeklyReport"("teamId", "authorId", "weekStart");
CREATE INDEX "TeamWeeklyReport_teamId_weekStart_status_idx" ON "TeamWeeklyReport"("teamId", "weekStart", "status");
CREATE INDEX "TeamWeeklyReport_authorId_weekStart_idx" ON "TeamWeeklyReport"("authorId", "weekStart");

ALTER TABLE "TeamWeeklyReport" ADD CONSTRAINT "TeamWeeklyReport_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamWeeklyReport" ADD CONSTRAINT "TeamWeeklyReport_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
