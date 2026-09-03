ALTER TABLE "ProjectMember"
ADD COLUMN "displayName" TEXT,
ADD COLUMN "title" TEXT,
ADD COLUMN "bio" TEXT,
ADD COLUMN "avatarUrl" TEXT;

CREATE TABLE "UsageCollectorRegistration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageCollectorRegistration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UsageCollectorDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "clientVersion" TEXT NOT NULL,
    "secretPrefix" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "lastStatus" TEXT NOT NULL DEFAULT 'REGISTERED',
    "lastError" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UsageCollectorDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TokenUsageDaily" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "tool" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" BIGINT NOT NULL DEFAULT 0,
    "outputTokens" BIGINT NOT NULL DEFAULT 0,
    "cacheTokens" BIGINT NOT NULL DEFAULT 0,
    "reasoningTokens" BIGINT NOT NULL DEFAULT 0,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DECIMAL(18,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TokenUsageDaily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TokenUsageEventReceipt" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "eventHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TokenUsageEventReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UsageCollectorRegistration_codeHash_key" ON "UsageCollectorRegistration"("codeHash");
CREATE INDEX "UsageCollectorRegistration_userId_expiresAt_idx" ON "UsageCollectorRegistration"("userId", "expiresAt");
CREATE UNIQUE INDEX "UsageCollectorDevice_secretHash_key" ON "UsageCollectorDevice"("secretHash");
CREATE UNIQUE INDEX "UsageCollectorDevice_userId_deviceId_key" ON "UsageCollectorDevice"("userId", "deviceId");
CREATE INDEX "UsageCollectorDevice_userId_revokedAt_idx" ON "UsageCollectorDevice"("userId", "revokedAt");
CREATE UNIQUE INDEX "TokenUsageDaily_deviceId_date_tool_model_key" ON "TokenUsageDaily"("deviceId", "date", "tool", "model");
CREATE INDEX "TokenUsageDaily_userId_date_idx" ON "TokenUsageDaily"("userId", "date");
CREATE UNIQUE INDEX "TokenUsageEventReceipt_deviceId_eventHash_key" ON "TokenUsageEventReceipt"("deviceId", "eventHash");
CREATE INDEX "TokenUsageEventReceipt_createdAt_idx" ON "TokenUsageEventReceipt"("createdAt");

ALTER TABLE "UsageCollectorRegistration" ADD CONSTRAINT "UsageCollectorRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageCollectorDevice" ADD CONSTRAINT "UsageCollectorDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TokenUsageDaily" ADD CONSTRAINT "TokenUsageDaily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TokenUsageDaily" ADD CONSTRAINT "TokenUsageDaily_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "UsageCollectorDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TokenUsageEventReceipt" ADD CONSTRAINT "TokenUsageEventReceipt_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "UsageCollectorDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
