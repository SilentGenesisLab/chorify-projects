import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/deployment";
import { failDeployment } from "@/lib/deployment-run";

type WorkflowRunEvent = {
  action?: string;
  workflow_run?: {
    id?: number;
    status?: string;
    conclusion?: string | null;
    html_url?: string;
    display_title?: string;
    name?: string;
  };
};

export async function POST(request: NextRequest) {
  const payload = await request.text();
  if (!verifyWebhookSignature(payload, request.headers.get("x-hub-signature-256"), process.env.GITHUB_WEBHOOK_SECRET || ""))
    return NextResponse.json({ error: "Webhook signature invalid" }, { status: 401 });
  if (request.headers.get("x-github-event") !== "workflow_run") return NextResponse.json({ ok: true, ignored: true });
  const event = JSON.parse(payload) as WorkflowRunEvent;
  const workflow = event.workflow_run;
  const runId = workflow?.display_title?.match(/chorify-([a-z0-9]+)/i)?.[1];
  if (!runId || !workflow?.id) return NextResponse.json({ ok: true, ignored: true });
  const run = await prisma.deploymentRun.findUnique({ where: { id: runId } });
  if (!run) return NextResponse.json({ ok: true, ignored: true });
  const githubRunId = String(workflow.id);
  if (workflow.status === "in_progress") {
    await prisma.deploymentRun.update({ where: { id: run.id }, data: { status: run.status === "DISPATCHED" ? "BUILDING" : run.status, githubRunId, githubRunUrl: workflow.html_url, startedAt: run.startedAt || new Date() } });
  } else if (workflow.status === "completed" && workflow.conclusion && workflow.conclusion !== "success") {
    await failDeployment(run.id, `GitHub Actions ${workflow.conclusion}`);
    await prisma.deploymentRun.update({ where: { id: run.id }, data: { githubRunId, githubRunUrl: workflow.html_url } });
  } else if (workflow.status === "completed" && workflow.conclusion === "success" && !["SUCCEEDED", "ROLLED_BACK"].includes(run.status)) {
    await prisma.deploymentRun.update({ where: { id: run.id }, data: { status: "VERIFYING", githubRunId, githubRunUrl: workflow.html_url } });
  }
  return NextResponse.json({ ok: true });
}
