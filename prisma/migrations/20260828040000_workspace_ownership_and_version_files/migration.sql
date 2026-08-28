ALTER TABLE "Requirement"
ADD COLUMN "requesterId" TEXT,
ADD COLUMN "closedAt" TIMESTAMP(3);

ALTER TABLE "Version"
ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN "ownerId" TEXT;

CREATE TABLE "RequirementParticipant" (
    "requirementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "RequirementParticipant_pkey" PRIMARY KEY ("requirementId", "userId")
);

CREATE TABLE "VersionParticipant" (
    "versionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "VersionParticipant_pkey" PRIMARY KEY ("versionId", "userId")
);

CREATE INDEX "RequirementParticipant_userId_idx" ON "RequirementParticipant"("userId");
CREATE INDEX "VersionParticipant_userId_idx" ON "VersionParticipant"("userId");

ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_requesterId_fkey"
FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Version" ADD CONSTRAINT "Version_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RequirementParticipant" ADD CONSTRAINT "RequirementParticipant_requirementId_fkey"
FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequirementParticipant" ADD CONSTRAINT "RequirementParticipant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VersionParticipant" ADD CONSTRAINT "VersionParticipant_versionId_fkey"
FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VersionParticipant" ADD CONSTRAINT "VersionParticipant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "Requirement" r
SET "requesterId" = (
  SELECT "userId" FROM "ProjectMember"
  WHERE "projectId" = r."projectId"
  ORDER BY CASE "role"::text WHEN 'OWNER' THEN 0 WHEN 'MANAGER' THEN 1 ELSE 2 END
  LIMIT 1
)
WHERE r."requesterId" IS NULL;

UPDATE "Version" v
SET "ownerId" = (
  SELECT "userId" FROM "ProjectMember"
  WHERE "projectId" = v."projectId"
  ORDER BY CASE "role"::text WHEN 'OWNER' THEN 0 WHEN 'MANAGER' THEN 1 ELSE 2 END
  LIMIT 1
)
WHERE v."ownerId" IS NULL;
