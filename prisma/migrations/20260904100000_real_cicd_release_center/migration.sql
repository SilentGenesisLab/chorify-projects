-- CreateEnum
CREATE TYPE "RepositoryConnectionStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "DeployableServiceKind" AS ENUM ('WEB', 'API', 'WORKER');

-- CreateEnum
CREATE TYPE "DeploymentEnvironmentKind" AS ENUM ('STAGING', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "DeploymentStrategy" AS ENUM ('BLUE_GREEN');

-- CreateEnum
CREATE TYPE "EnvironmentHealthStatus" AS ENUM ('UNKNOWN', 'HEALTHY', 'DEGRADED', 'DOWN');

-- CreateEnum
CREATE TYPE "BuildArtifactStatus" AS ENUM ('BUILDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "DeploymentRunType" AS ENUM ('DEPLOY', 'ROLLBACK', 'AUTO_ROLLBACK');

-- CreateEnum
CREATE TYPE "DeploymentRunStatus" AS ENUM ('QUEUED', 'WAITING_APPROVAL', 'DISPATCHED', 'BUILDING', 'DEPLOYING', 'VERIFYING', 'SUCCEEDED', 'FAILED', 'ROLLED_BACK', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeploymentStepStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "DeploymentApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MigrationRisk" AS ENUM ('NONE', 'BACKWARD_COMPATIBLE', 'BREAKING');

-- AlterTable
ALTER TABLE "Release" ADD COLUMN     "commitSummary" JSONB,
ADD COLUMN     "deploymentRunId" TEXT,
ADD COLUMN     "imageSummary" JSONB,
ADD COLUMN     "isLegacy" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ProjectRepository" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "workflowPath" TEXT NOT NULL DEFAULT 'chorify-deploy.yml',
    "status" "RepositoryConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRepository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeployableService" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "DeployableServiceKind" NOT NULL DEFAULT 'WEB',
    "dockerfilePath" TEXT NOT NULL DEFAULT 'Dockerfile',
    "buildContext" TEXT NOT NULL DEFAULT '.',
    "healthPath" TEXT NOT NULL DEFAULT '/api/health',
    "internalPort" INTEGER NOT NULL DEFAULT 3000,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeployableService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentEnvironment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "DeploymentEnvironmentKind" NOT NULL,
    "url" TEXT NOT NULL,
    "githubEnvironment" TEXT NOT NULL,
    "strategy" "DeploymentStrategy" NOT NULL DEFAULT 'BLUE_GREEN',
    "healthPath" TEXT NOT NULL DEFAULT '/api/health',
    "activeSlot" TEXT,
    "currentDeploymentRunId" TEXT,
    "healthStatus" "EnvironmentHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeploymentEnvironment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VersionComponent" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "branch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VersionComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildArtifact" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionComponentId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "deploymentRunId" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "imageRef" TEXT NOT NULL,
    "imageDigest" TEXT,
    "status" "BuildArtifactStatus" NOT NULL DEFAULT 'BUILDING',
    "testsPassed" BOOLEAN,
    "manifest" JSONB,
    "builtAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuildArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "rollbackOfId" TEXT,
    "type" "DeploymentRunType" NOT NULL DEFAULT 'DEPLOY',
    "status" "DeploymentRunStatus" NOT NULL DEFAULT 'QUEUED',
    "lockKey" TEXT,
    "manifestHash" TEXT NOT NULL,
    "migrationRisk" "MigrationRisk" NOT NULL DEFAULT 'NONE',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "githubRunId" TEXT,
    "githubRunUrl" TEXT,
    "failureReason" TEXT,
    "activeSlot" TEXT,
    "previousSlot" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "DeploymentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentStep" (
    "id" TEXT NOT NULL,
    "deploymentRunId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "status" "DeploymentStepStatus" NOT NULL DEFAULT 'PENDING',
    "logsUrl" TEXT,
    "output" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "DeploymentStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentApproval" (
    "id" TEXT NOT NULL,
    "deploymentRunId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "status" "DeploymentApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "manifestHash" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeploymentApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentHealthCheck" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "deploymentRunId" TEXT,
    "status" "EnvironmentHealthStatus" NOT NULL,
    "statusCode" INTEGER,
    "latencyMs" INTEGER,
    "error" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvironmentHealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectRepository_installationId_idx" ON "ProjectRepository"("installationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRepository_projectId_fullName_key" ON "ProjectRepository"("projectId", "fullName");

-- CreateIndex
CREATE INDEX "DeployableService_repositoryId_idx" ON "DeployableService"("repositoryId");

-- CreateIndex
CREATE UNIQUE INDEX "DeployableService_projectId_slug_key" ON "DeployableService"("projectId", "slug");

-- CreateIndex
CREATE INDEX "DeploymentEnvironment_projectId_kind_idx" ON "DeploymentEnvironment"("projectId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentEnvironment_projectId_slug_key" ON "DeploymentEnvironment"("projectId", "slug");

-- CreateIndex
CREATE INDEX "VersionComponent_serviceId_commitSha_idx" ON "VersionComponent"("serviceId", "commitSha");

-- CreateIndex
CREATE UNIQUE INDEX "VersionComponent_versionId_serviceId_key" ON "VersionComponent"("versionId", "serviceId");

-- CreateIndex
CREATE INDEX "BuildArtifact_projectId_createdAt_idx" ON "BuildArtifact"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "BuildArtifact_deploymentRunId_idx" ON "BuildArtifact"("deploymentRunId");

-- CreateIndex
CREATE UNIQUE INDEX "BuildArtifact_deploymentRunId_serviceId_key" ON "BuildArtifact"("deploymentRunId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentRun_lockKey_key" ON "DeploymentRun"("lockKey");

-- CreateIndex
CREATE INDEX "DeploymentRun_projectId_queuedAt_idx" ON "DeploymentRun"("projectId", "queuedAt");

-- CreateIndex
CREATE INDEX "DeploymentRun_environmentId_status_idx" ON "DeploymentRun"("environmentId", "status");

-- CreateIndex
CREATE INDEX "DeploymentRun_githubRunId_idx" ON "DeploymentRun"("githubRunId");

-- CreateIndex
CREATE INDEX "DeploymentStep_deploymentRunId_sortOrder_idx" ON "DeploymentStep"("deploymentRunId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentStep_deploymentRunId_key_key" ON "DeploymentStep"("deploymentRunId", "key");

-- CreateIndex
CREATE INDEX "DeploymentApproval_deploymentRunId_status_idx" ON "DeploymentApproval"("deploymentRunId", "status");

-- CreateIndex
CREATE INDEX "DeploymentApproval_decidedById_decidedAt_idx" ON "DeploymentApproval"("decidedById", "decidedAt");

-- CreateIndex
CREATE INDEX "EnvironmentHealthCheck_environmentId_checkedAt_idx" ON "EnvironmentHealthCheck"("environmentId", "checkedAt");

-- CreateIndex
CREATE INDEX "EnvironmentHealthCheck_deploymentRunId_idx" ON "EnvironmentHealthCheck"("deploymentRunId");

-- CreateIndex
CREATE UNIQUE INDEX "Release_deploymentRunId_key" ON "Release"("deploymentRunId");

-- AddForeignKey
ALTER TABLE "Release" ADD CONSTRAINT "Release_deploymentRunId_fkey" FOREIGN KEY ("deploymentRunId") REFERENCES "DeploymentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRepository" ADD CONSTRAINT "ProjectRepository_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeployableService" ADD CONSTRAINT "DeployableService_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeployableService" ADD CONSTRAINT "DeployableService_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "ProjectRepository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentEnvironment" ADD CONSTRAINT "DeploymentEnvironment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersionComponent" ADD CONSTRAINT "VersionComponent_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersionComponent" ADD CONSTRAINT "VersionComponent_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "DeployableService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildArtifact" ADD CONSTRAINT "BuildArtifact_versionComponentId_fkey" FOREIGN KEY ("versionComponentId") REFERENCES "VersionComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildArtifact" ADD CONSTRAINT "BuildArtifact_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "DeployableService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildArtifact" ADD CONSTRAINT "BuildArtifact_deploymentRunId_fkey" FOREIGN KEY ("deploymentRunId") REFERENCES "DeploymentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentRun" ADD CONSTRAINT "DeploymentRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentRun" ADD CONSTRAINT "DeploymentRun_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentRun" ADD CONSTRAINT "DeploymentRun_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "DeploymentEnvironment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentRun" ADD CONSTRAINT "DeploymentRun_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentRun" ADD CONSTRAINT "DeploymentRun_rollbackOfId_fkey" FOREIGN KEY ("rollbackOfId") REFERENCES "DeploymentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentStep" ADD CONSTRAINT "DeploymentStep_deploymentRunId_fkey" FOREIGN KEY ("deploymentRunId") REFERENCES "DeploymentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentApproval" ADD CONSTRAINT "DeploymentApproval_deploymentRunId_fkey" FOREIGN KEY ("deploymentRunId") REFERENCES "DeploymentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentApproval" ADD CONSTRAINT "DeploymentApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentApproval" ADD CONSTRAINT "DeploymentApproval_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentHealthCheck" ADD CONSTRAINT "EnvironmentHealthCheck_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "DeploymentEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentHealthCheck" ADD CONSTRAINT "EnvironmentHealthCheck_deploymentRunId_fkey" FOREIGN KEY ("deploymentRunId") REFERENCES "DeploymentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
