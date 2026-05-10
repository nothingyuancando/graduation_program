import crypto from "crypto";

const SECRET = process.env.JWT_SECRET || "dev-secret-please-change";

/** 生成简单的 HMAC-SHA256 JWT（不依赖任何外部包） */
export function signToken(payload: { sub: string; email: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 })
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

/** 解码 JWT payload。生产环境应在这里校验签名并收紧密钥配置。 */
export function decodeToken(token: string): { sub: string; email: string; exp: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}
