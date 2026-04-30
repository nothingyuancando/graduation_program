import { NextRequest } from "next/server";
import { decodeToken } from "@/lib/jwt";

interface AuthUser {
  id: string;
  email: string;
}

/** 从请求 Cookie 中解析当前登录用户 */
export function getUserFromRequest(request: NextRequest): AuthUser | null {
  const token = request.cookies.get("auth-token")?.value;
  if (!token) return null;
  const payload = decodeToken(token);
  if (!payload) return null;
  return { id: payload.sub, email: payload.email };
}
