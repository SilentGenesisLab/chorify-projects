CREATE TYPE "AiUsageVisibility" AS ENUM ('SELF', 'MANAGERS', 'TEAM');

ALTER TABLE "TeamMember"
ADD COLUMN "aiUsageVisibility" "AiUsageVisibility" NOT NULL DEFAULT 'MANAGERS';

ALTER TABLE "TokenUsageDaily"
ADD COLUMN "activeSeconds" INTEGER NOT NULL DEFAULT 0;
