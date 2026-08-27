import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
export async function authenticatedUserId(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  return verifySessionToken(cookie);
}
