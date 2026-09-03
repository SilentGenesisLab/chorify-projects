import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUserId } from "@/lib/team-permissions";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { deviceId } = await params;
  const device = await prisma.usageCollectorDevice.findFirst({ where: { id: deviceId, userId } });
  if (!device) return NextResponse.json({ error: "采集设备不存在" }, { status: 404 });
  if (device.revokedAt) return NextResponse.json({ ok: true });
  await prisma.$transaction(async (tx) => {
    await tx.usageCollectorDevice.update({ where: { id: device.id }, data: { revokedAt: new Date(), lastStatus: "REVOKED" } });
    await tx.auditLog.create({ data: { userId, actorType: "USER", action: "REVOKE_USAGE_COLLECTOR_DEVICE", resource: "USAGE_COLLECTOR_DEVICE", resourceId: device.id, channel: "WEB", metadata: { deviceName: device.name } } });
  });
  return NextResponse.json({ ok: true });
}
