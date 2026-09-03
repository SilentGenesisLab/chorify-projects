import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUserId } from "@/lib/team-permissions";

export async function GET(request: NextRequest) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const devices = await prisma.usageCollectorDevice.findMany({
    where: { userId },
    select: { id: true, name: true, platform: true, clientVersion: true, secretPrefix: true, lastSeenAt: true, lastStatus: true, lastError: true, revokedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ devices });
}
