import { NextRequest, NextResponse } from "next/server";
import { decodeToken } from "@/lib/jwt";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;

  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const payload = decodeToken(token);
  if (!payload) {
    const res = NextResponse.json({ user: null }, { status: 401 });
    res.cookies.delete("auth-token");
    return res;
  }

  return NextResponse.json({
    user: { id: payload.sub, email: payload.email },
  });
}
