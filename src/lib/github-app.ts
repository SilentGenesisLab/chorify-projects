import { importPKCS8, SignJWT } from "jose";
import { createPrivateKey } from "node:crypto";

const API = "https://api.github.com";

function privateKey() {
  const raw = process.env.GITHUB_APP_PRIVATE_KEY || "";
  if (!raw) return "";
  return raw.includes("BEGIN PRIVATE KEY")
    ? raw.replace(/\\n/g, "\n")
    : Buffer.from(raw, "base64").toString("utf8");
}

async function appJwt() {
  const appId = process.env.GITHUB_APP_ID;
  const key = privateKey();
  if (!appId || !key) throw new Error("GitHub App 尚未配置");
  const now = Math.floor(Date.now() / 1000);
  const pkcs8 = createPrivateKey(key).export({ type: "pkcs8", format: "pem" }).toString();
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(appId)
    .setIssuedAt(now - 30)
    .setExpirationTime(now + 540)
    .sign(await importPKCS8(pkcs8, "RS256"));
}

async function request<T>(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub API ${response.status}: ${detail.slice(0, 300)}`);
  }
  return response.status === 204 ? (null as T) : ((await response.json()) as T);
}

export async function installationToken(installationId: string) {
  if (process.env.GITHUB_BOOTSTRAP_TOKEN) return process.env.GITHUB_BOOTSTRAP_TOKEN;
  const result = await request<{ token: string }>(
    `/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
    await appJwt(),
    { method: "POST", body: JSON.stringify({}) },
  );
  return result.token;
}

export async function dispatchDeployment(input: {
  installationId: string;
  owner: string;
  repository: string;
  workflowPath: string;
  ref: string;
  deploymentRunId: string;
  environment: string;
  commitSha: string;
  imageName: string;
  serviceId: string;
  serviceSlug: string;
  dockerfilePath: string;
  buildContext: string;
  mode?: "deploy" | "rollback";
  imageRef?: string;
  previousCommitSha?: string;
}) {
  const token = await installationToken(input.installationId);
  await request(
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repository)}/actions/workflows/${encodeURIComponent(input.workflowPath)}/dispatches`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        ref: input.ref,
        inputs: {
          deployment_run_id: input.deploymentRunId,
          environment: input.environment,
          commit_sha: input.commitSha,
          image_name: input.imageName,
          service_id: input.serviceId,
          service_slug: input.serviceSlug,
          dockerfile_path: input.dockerfilePath,
          build_context: input.buildContext,
          mode: input.mode || "deploy",
          image_ref: input.imageRef || "",
          previous_commit_sha: input.previousCommitSha || "",
        },
      }),
    },
  );
}

export async function githubRun(owner: string, repository: string, installationId: string, runId: string) {
  const token = await installationToken(installationId);
  return request<{
    id: number;
    status: string;
    conclusion: string | null;
    html_url: string;
    display_title: string;
  }>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/actions/runs/${encodeURIComponent(runId)}`, token);
}

export async function resolveCommit(owner: string, repository: string, installationId: string, ref: string) {
  const token = await installationToken(installationId);
  return request<{ sha: string; html_url: string; commit: { message: string } }>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/commits/${encodeURIComponent(ref)}`,
    token,
  );
}
