import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getOrCreateLearningProfile } from "@/lib/services/learning-profile";

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const profile = await getOrCreateLearningProfile(user.id);
  return NextResponse.json({ profile });
}

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const profile = await getOrCreateLearningProfile(user.id, {
    forceRecompute: true,
  });

  return NextResponse.json({ profile });
}
