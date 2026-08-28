import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { currentApiActor } from "@/lib/api-request-context";
export async function authenticatedUserId(request: Request) {
  const apiActor = currentApiActor();
  if (apiActor && new URL(request.url).pathname.startsWith("/api/v1/")) return apiActor.userId;
  const cookie = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  return verifySessionToken(cookie);
}
