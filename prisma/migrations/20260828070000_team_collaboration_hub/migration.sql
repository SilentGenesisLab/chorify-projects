CREATE TYPE "OkrPeriodType" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');
CREATE TYPE "OkrStatus" AS ENUM ('DRAFT', 'ACTIVE', 'AT_RISK', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "MessagePriority" AS ENUM ('NORMAL', 'IMPORTANT', 'URGENT');

ALTER TABLE "Team" ADD COLUMN "mission" TEXT, ADD COLUMN "responsibilities" TEXT;
ALTER TABLE "TeamMember" ADD COLUMN "title" TEXT, ADD COLUMN "responsibility" TEXT, ADD COLUMN "bio" TEXT;
ALTER TABLE "Task" ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE TABLE "TeamObjective" ("id" TEXT NOT NULL, "teamId" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "periodType" "OkrPeriodType" NOT NULL, "periodLabel" TEXT NOT NULL, "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL, "ownerId" TEXT NOT NULL, "status" "OkrStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "TeamObjective_pkey" PRIMARY KEY ("id"));
CREATE TABLE "TeamKeyResult" ("id" TEXT NOT NULL, "objectiveId" TEXT NOT NULL, "title" TEXT NOT NULL, "targetValue" DOUBLE PRECISION NOT NULL, "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0, "unit" TEXT NOT NULL, "confidence" INTEGER NOT NULL DEFAULT 50, "ownerId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "TeamKeyResult_pkey" PRIMARY KEY ("id"));
CREATE TABLE "TeamKeyResultAlignment" ("keyResultId" TEXT NOT NULL, "userId" TEXT NOT NULL, CONSTRAINT "TeamKeyResultAlignment_pkey" PRIMARY KEY ("keyResultId","userId"));
CREATE TABLE "TeamKeyResultCheckIn" ("id" TEXT NOT NULL, "keyResultId" TEXT NOT NULL, "authorId" TEXT NOT NULL, "currentValue" DOUBLE PRECISION NOT NULL, "confidence" INTEGER NOT NULL, "note" TEXT NOT NULL DEFAULT '', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "TeamKeyResultCheckIn_pkey" PRIMARY KEY ("id"));
CREATE TABLE "TeamMessage" ("id" TEXT NOT NULL, "teamId" TEXT NOT NULL, "senderId" TEXT NOT NULL, "title" TEXT NOT NULL, "body" TEXT NOT NULL, "priority" "MessagePriority" NOT NULL DEFAULT 'NORMAL', "projectId" TEXT, "taskId" TEXT, "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "TeamMessage_pkey" PRIMARY KEY ("id"));
CREATE TABLE "TeamMessageRecipient" ("messageId" TEXT NOT NULL, "userId" TEXT NOT NULL, "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "readAt" TIMESTAMP(3), CONSTRAINT "TeamMessageRecipient_pkey" PRIMARY KEY ("messageId","userId"));

CREATE INDEX "TeamObjective_teamId_startsAt_endsAt_idx" ON "TeamObjective"("teamId", "startsAt", "endsAt");
CREATE INDEX "TeamKeyResult_objectiveId_idx" ON "TeamKeyResult"("objectiveId");
CREATE INDEX "TeamKeyResultAlignment_userId_idx" ON "TeamKeyResultAlignment"("userId");
CREATE INDEX "TeamKeyResultCheckIn_keyResultId_createdAt_idx" ON "TeamKeyResultCheckIn"("keyResultId", "createdAt");
CREATE INDEX "TeamMessage_teamId_createdAt_idx" ON "TeamMessage"("teamId", "createdAt");
CREATE INDEX "TeamMessageRecipient_userId_readAt_deliveredAt_idx" ON "TeamMessageRecipient"("userId", "readAt", "deliveredAt");

ALTER TABLE "TeamObjective" ADD CONSTRAINT "TeamObjective_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamObjective" ADD CONSTRAINT "TeamObjective_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamKeyResult" ADD CONSTRAINT "TeamKeyResult_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "TeamObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamKeyResult" ADD CONSTRAINT "TeamKeyResult_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamKeyResultAlignment" ADD CONSTRAINT "TeamKeyResultAlignment_keyResultId_fkey" FOREIGN KEY ("keyResultId") REFERENCES "TeamKeyResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamKeyResultAlignment" ADD CONSTRAINT "TeamKeyResultAlignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamKeyResultCheckIn" ADD CONSTRAINT "TeamKeyResultCheckIn_keyResultId_fkey" FOREIGN KEY ("keyResultId") REFERENCES "TeamKeyResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamKeyResultCheckIn" ADD CONSTRAINT "TeamKeyResultCheckIn_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamMessage" ADD CONSTRAINT "TeamMessage_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMessage" ADD CONSTRAINT "TeamMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamMessageRecipient" ADD CONSTRAINT "TeamMessageRecipient_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TeamMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMessageRecipient" ADD CONSTRAINT "TeamMessageRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
