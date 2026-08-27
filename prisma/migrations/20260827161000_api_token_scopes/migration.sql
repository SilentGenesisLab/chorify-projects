ALTER TABLE "ApiToken" ADD COLUMN "allProjects" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ApiToken" ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ApiToken" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "ApiToken"
SET "allProjects" = ("projectId" IS NULL),
    "permissions" = CASE
      WHEN "mode" = 'READ' THEN ARRAY['project:read','requirement:read','task:read','bug:read','version:read','file:read','document:read']::TEXT[]
      ELSE ARRAY['project:read','requirement:read','task:read','task:report','bug:read','version:read','file:read','document:read']::TEXT[]
    END;

CREATE TABLE "ApiTokenProject" (
  "tokenId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  CONSTRAINT "ApiTokenProject_pkey" PRIMARY KEY ("tokenId", "projectId")
);

INSERT INTO "ApiTokenProject" ("tokenId", "projectId")
SELECT "id", "projectId" FROM "ApiToken" WHERE "projectId" IS NOT NULL;

ALTER TABLE "ApiToken" DROP CONSTRAINT IF EXISTS "ApiToken_projectId_fkey";
ALTER TABLE "ApiToken" DROP COLUMN "projectId";
ALTER TABLE "ApiToken" DROP COLUMN "mode";
DROP TYPE IF EXISTS "TokenMode";

CREATE INDEX "ApiToken_userId_createdAt_idx" ON "ApiToken"("userId", "createdAt");
CREATE INDEX "ApiTokenProject_projectId_idx" ON "ApiTokenProject"("projectId");
ALTER TABLE "ApiTokenProject" ADD CONSTRAINT "ApiTokenProject_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "ApiToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiTokenProject" ADD CONSTRAINT "ApiTokenProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
