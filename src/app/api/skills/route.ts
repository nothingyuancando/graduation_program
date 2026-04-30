import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getOrCreateSkillProfile, updateSkillProfile } from "@/lib/services/skill-profile";

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const profile = await getOrCreateSkillProfile(user.id);
    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Error fetching skill profile:", error);
    return NextResponse.json({ error: "获取技能画像失败" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const body = await request.json();
    const profile = await updateSkillProfile(user.id, body);
    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Error updating skill profile:", error);
    return NextResponse.json({ error: "更新技能画像失败" }, { status: 500 });
  }
}
