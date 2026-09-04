import { describe, expect, it } from "vitest";
import {
  canApproveDeployment,
  deploymentHealthStatus,
  deploymentManifestHash,
  migrationRisk,
  shouldApplyDeploymentStepEvent,
  verifyWebhookSignature,
} from "@/lib/deployment";
import { createHmac } from "node:crypto";

describe("deployment rules", () => {
  it("creates a stable manifest hash independent of component order", () => {
    const base = { projectId: "p", versionId: "v", environmentId: "e" };
    const a = { serviceId: "a", service: "web", repository: "org/web", commitSha: "ABC" };
    const b = { serviceId: "b", service: "api", repository: "org/api", commitSha: "DEF" };
    expect(deploymentManifestHash({ ...base, components: [a, b] })).toBe(
      deploymentManifestHash({ ...base, components: [b, a] }),
    );
  });

  it("requires a different approver and the exact approved manifest", () => {
    const base = {
      requesterId: "owner",
      approverId: "manager",
      manifestHash: "same",
      approvalManifestHash: "same",
      expiresAt: new Date("2030-01-01"),
      now: new Date("2029-01-01"),
    };
    expect(canApproveDeployment(base)).toBeNull();
    expect(canApproveDeployment({ ...base, approverId: "owner" })).toContain("不能审批");
    expect(canApproveDeployment({ ...base, manifestHash: "changed" })).toContain("已变化");
  });

  it("marks an environment down after three consecutive failures", () => {
    expect(deploymentHealthStatus(0, false)).toEqual({ status: "DEGRADED", consecutiveFailures: 1 });
    expect(deploymentHealthStatus(2, false)).toEqual({ status: "DOWN", consecutiveFailures: 3 });
    expect(deploymentHealthStatus(8, true)).toEqual({ status: "HEALTHY", consecutiveFailures: 0 });
  });

  it("blocks destructive migration patterns", () => {
    expect(migrationRisk('ALTER TABLE "User" DROP COLUMN "name";')).toBe("BREAKING");
    expect(migrationRisk('ALTER TABLE "User" ADD COLUMN "nickname" TEXT;')).toBe("BACKWARD_COMPATIBLE");
    expect(migrationRisk("SELECT 1;")).toBe("NONE");
  });

  it("verifies GitHub's HMAC webhook signature", () => {
    const payload = '{"action":"completed"}';
    const signature = `sha256=${createHmac("sha256", "secret").update(payload).digest("hex")}`;
    expect(verifyWebhookSignature(payload, signature, "secret")).toBe(true);
    expect(verifyWebhookSignature(payload, signature, "wrong")).toBe(false);
  });

  it("keeps build-only steps skipped during rollback callbacks", () => {
    expect(shouldApplyDeploymentStepEvent("ROLLBACK", "checkout")).toBe(false);
    expect(shouldApplyDeploymentStepEvent("ROLLBACK", "migration")).toBe(false);
    expect(shouldApplyDeploymentStepEvent("ROLLBACK", "deploy")).toBe(true);
    expect(shouldApplyDeploymentStepEvent("DEPLOY", "checkout")).toBe(true);
  });
});
