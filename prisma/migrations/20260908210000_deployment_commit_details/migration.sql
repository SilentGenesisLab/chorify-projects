ALTER TABLE "VersionComponent"
ADD COLUMN "commitMessage" TEXT,
ADD COLUMN "commitAuthor" TEXT,
ADD COLUMN "commitCommittedAt" TIMESTAMP(3),
ADD COLUMN "commitUrl" TEXT;

ALTER TABLE "BuildArtifact"
ADD COLUMN "commitMessage" TEXT,
ADD COLUMN "commitAuthor" TEXT,
ADD COLUMN "commitCommittedAt" TIMESTAMP(3),
ADD COLUMN "commitUrl" TEXT;
