ALTER TABLE "FileAsset"
  ADD COLUMN "creatorId" TEXT,
  ADD COLUMN "currentVersionId" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "folderId" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "size" SET DATA TYPE BIGINT;

CREATE TABLE "FileFolder" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "parentId" TEXT, "name" TEXT NOT NULL,
  "path" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL DEFAULT 0, "creatorId" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "FileFolder_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FileVersion" (
  "id" TEXT NOT NULL, "fileId" TEXT NOT NULL, "version" INTEGER NOT NULL, "objectKey" TEXT NOT NULL,
  "originalName" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "size" BIGINT NOT NULL, "sha256" TEXT,
  "uploaderId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FileVersion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FileUploadSession" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "folderId" TEXT, "fileId" TEXT, "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "size" BIGINT NOT NULL, "objectKey" TEXT NOT NULL,
  "multipartId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FileUploadSession_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FileShare" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "fileId" TEXT NOT NULL, "creatorId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL, "codeHash" TEXT, "expiresAt" TIMESTAMP(3) NOT NULL, "maxDownloads" INTEGER,
  "downloads" INTEGER NOT NULL DEFAULT 0, "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FileShare_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FileFolder_projectId_parentId_deletedAt_idx" ON "FileFolder"("projectId", "parentId", "deletedAt");
CREATE UNIQUE INDEX "FileFolder_projectId_parentId_name_key" ON "FileFolder"("projectId", "parentId", "name");
CREATE UNIQUE INDEX "FileVersion_objectKey_key" ON "FileVersion"("objectKey");
CREATE INDEX "FileVersion_fileId_createdAt_idx" ON "FileVersion"("fileId", "createdAt");
CREATE UNIQUE INDEX "FileVersion_fileId_version_key" ON "FileVersion"("fileId", "version");
CREATE UNIQUE INDEX "FileUploadSession_objectKey_key" ON "FileUploadSession"("objectKey");
CREATE INDEX "FileUploadSession_userId_status_expiresAt_idx" ON "FileUploadSession"("userId", "status", "expiresAt");
CREATE UNIQUE INDEX "FileShare_tokenHash_key" ON "FileShare"("tokenHash");
CREATE INDEX "FileShare_fileId_createdAt_idx" ON "FileShare"("fileId", "createdAt");
CREATE INDEX "FileShare_projectId_revokedAt_idx" ON "FileShare"("projectId", "revokedAt");
CREATE UNIQUE INDEX "FileAsset_currentVersionId_key" ON "FileAsset"("currentVersionId");
CREATE INDEX "FileAsset_projectId_folderId_deletedAt_idx" ON "FileAsset"("projectId", "folderId", "deletedAt");

ALTER TABLE "FileFolder" ADD CONSTRAINT "FileFolder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileFolder" ADD CONSTRAINT "FileFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FileFolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FileFolder" ADD CONSTRAINT "FileFolder_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "FileFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FileVersion" ADD CONSTRAINT "FileVersion_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileVersion" ADD CONSTRAINT "FileVersion_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "FileVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FileUploadSession" ADD CONSTRAINT "FileUploadSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileUploadSession" ADD CONSTRAINT "FileUploadSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileShare" ADD CONSTRAINT "FileShare_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileShare" ADD CONSTRAINT "FileShare_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileShare" ADD CONSTRAINT "FileShare_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
