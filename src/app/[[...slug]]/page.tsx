import { ChorifyApp } from "@/components/chorify-app";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export default async function Page({ params, searchParams }: { params: Promise<{ slug?: string[] }>; searchParams: Promise<{ next?: string }> }) {
  const { slug = [] } = await params;
  const requestedNext = (await searchParams).next;
  const nextPath = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "";
  const route = slug.join("/") || "dashboard";
  const userId = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  const user = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { name: true, systemRole: true } }) : null;
  return <ChorifyApp route={route} nextPath={nextPath} user={user ? { name: user.name, role: user.systemRole === "ADMIN" ? "系统管理员" : "项目成员" } : undefined} />;
}
