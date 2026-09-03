import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateCollector } from "@/lib/usage-collector";

const schema = z.object({ clientVersion: z.string().trim().min(1).max(30), status: z.enum(["HEALTHY", "WARNING", "ERROR"]), error: z.string().trim().max(500).nullable().optional() });

export async function POST(request: NextRequest) {
  const device = await authenticateCollector(request);
  if (!device) return NextResponse.json({ error: "采集器凭据无效或已撤销" }, { status: 401 });
  const input = schema.safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: "心跳参数不正确" }, { status: 400 });
  await prisma.$transaction(async (tx) => {
    await tx.usageCollectorDevice.update({ where: { id: device.id }, data: { clientVersion: input.data.clientVersion, lastSeenAt: new Date(), lastStatus: input.data.status, lastError: input.data.error || null } });
    if (input.data.status === "ERROR" && device.lastStatus !== "ERROR") await tx.auditLog.create({ data: { userId: device.userId, actorType: "USER", action: "USAGE_COLLECTOR_ERROR", resource: "USAGE_COLLECTOR_DEVICE", resourceId: device.id, channel: "COLLECTOR", metadata: { clientVersion: input.data.clientVersion } } });
  });
  return NextResponse.json({ ok: true });
}
