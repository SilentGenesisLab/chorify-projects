import type { NextRequest } from "next/server";

export function getAppOrigin(request: NextRequest) {
  return (process.env.APP_URL || request.nextUrl.origin).replace(/\/+$/, "");
}
