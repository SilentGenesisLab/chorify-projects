import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const createPersonalToken = () => {
  const secret = randomBytes(30).toString("base64url");
  const token = `chp_${secret}`;
  return { token, prefix: token.slice(0, 12), tokenHash: sha256(token) };
};

export const createTeamInviteToken = () => {
  const token = `cht_${randomBytes(32).toString("base64url")}`;
  return { token, prefix: token.slice(0, 12), tokenHash: sha256(token) };
};

const inviteCipherKey = (secret = process.env.AUTH_SECRET) => {
  if (!secret) throw new Error("AUTH_SECRET is required to protect team invitation links");
  return createHash("sha256").update(`chorify-team-invite:${secret}`).digest();
};

export function encryptTeamInviteToken(token: string, secret?: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", inviteCipherKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptTeamInviteToken(payload: string, secret?: string) {
  try {
    const [version, iv, tag, ciphertext] = payload.split(".");
    if (version !== "v1" || !iv || !tag || !ciphertext) return null;
    const decipher = createDecipheriv("aes-256-gcm", inviteCipherKey(secret), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
