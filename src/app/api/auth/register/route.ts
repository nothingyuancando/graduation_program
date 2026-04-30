import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseServiceClient } from "@/storage/database/supabase-client";
import { signToken } from "@/lib/jwt";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "邮箱和密码不能为空" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "密码至少需要6位" }, { status: 400 });
    }

    const client = getSupabaseServiceClient();
    const normalizedEmail = email.toLowerCase().trim();

    // 检查邮箱是否已注册
    const { data: existing } = await client
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .single();

    if (existing) {
      return NextResponse.json({ error: "该邮箱已被注册" }, { status: 400 });
    }

    // 哈希密码
    const passwordHash = await bcrypt.hash(password, 10);

    // 创建用户
    const { data: user, error } = await client
      .from("users")
      .insert({ email: normalizedEmail, password: passwordHash })
      .select("id, email")
      .single();

    if (error || !user) {
      return NextResponse.json({ error: "注册失败，请稍后重试" }, { status: 500 });
    }

    const token = signToken({ sub: user.id, email: user.email });

    const response = NextResponse.json({
      user: { id: user.id, email: user.email },
    });

    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "注册失败，请稍后重试" }, { status: 500 });
  }
}
