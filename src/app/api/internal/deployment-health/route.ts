import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkDeploymentEnvironment } from "@/lib/deployment-run";

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const environments = await prisma.deploymentEnvironment.findMany({ where: { enabled: true } });
  const results = await Promise.allSettled(environments.map((item) => checkDeploymentEnvironment(item.id, item.currentDeploymentRunId || undefined)));
  return NextResponse.json({ checked: environments.length, healthy: results.filter((item) => item.status === "fulfilled" && item.value.status === "HEALTHY").length, failed: results.filter((item) => item.status === "rejected").length });
}
