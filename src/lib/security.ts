import { createHash, randomBytes } from "node:crypto";

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const createPersonalToken = () => {
  const secret = randomBytes(30).toString("base64url");
  const token = `chp_${secret}`;
  return { token, prefix: token.slice(0, 12), tokenHash: sha256(token) };
};
