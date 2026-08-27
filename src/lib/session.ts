import { SignJWT } from "jose";

export async function createSessionToken(userId: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET 未配置或长度不足 32 位");
  return new SignJWT({ userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(new TextEncoder().encode(secret));
}

export function sessionCookie(token: string) {
  return `chorify_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
