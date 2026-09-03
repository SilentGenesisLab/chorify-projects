import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateCollector } from "@/lib/usage-collector";

const eventSchema = z.object({
  eventHash: z.string().min(16).max(128),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tool: z.enum(["CODEX", "CLAUDE"]),
  model: z.string().trim().min(1).max(120).default("unknown"),
  inputTokens: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  outputTokens: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  cacheTokens: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  reasoningTokens: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  sessions: z.number().int().min(0).max(1_000).default(0),
  estimatedCost: z.number().min(0).max(1_000_000).nullable().default(null),
});
const batchSchema = z.object({ events: z.array(eventSchema).min(1).max(500), clientVersion: z.string().trim().min(1).max(30) });

export async function POST(request: NextRequest) {
  const device = await authenticateCollector(request);
  if (!device) return NextResponse.json({ error: "采集器凭据无效或已撤销" }, { status: 401 });
  const input = batchSchema.safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: "用量批次格式不正确" }, { status: 400 });
  let accepted = 0;
  await prisma.$transaction(async (tx) => {
    for (const event of input.data.events) {
      const receipt = await tx.tokenUsageEventReceipt.createMany({ data: [{ deviceId: device.id, eventHash: event.eventHash }], skipDuplicates: true });
      if (!receipt.count) continue;
      accepted++;
      const date = new Date(`${event.date}T00:00:00.000Z`);
      await tx.tokenUsageDaily.upsert({
        where: { deviceId_date_tool_model: { deviceId: device.id, date, tool: event.tool, model: event.model } },
        create: { userId: device.userId, deviceId: device.id, date, tool: event.tool, model: event.model, inputTokens: BigInt(event.inputTokens), outputTokens: BigInt(event.outputTokens), cacheTokens: BigInt(event.cacheTokens), reasoningTokens: BigInt(event.reasoningTokens), sessions: event.sessions, estimatedCost: event.estimatedCost },
        update: { inputTokens: { increment: BigInt(event.inputTokens) }, outputTokens: { increment: BigInt(event.outputTokens) }, cacheTokens: { increment: BigInt(event.cacheTokens) }, reasoningTokens: { increment: BigInt(event.reasoningTokens) }, sessions: { increment: event.sessions }, ...(event.estimatedCost === null ? {} : { estimatedCost: { increment: event.estimatedCost } }) },
      });
    }
    await tx.usageCollectorDevice.update({ where: { id: device.id }, data: { clientVersion: input.data.clientVersion, lastSeenAt: new Date(), lastStatus: "HEALTHY", lastError: null } });
  });
  return NextResponse.json({ accepted, duplicates: input.data.events.length - accepted });
}
