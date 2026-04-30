import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getApiClient();

    const { data, error } = await client
      .from("notes")
      .select("*")
      .eq("id", id)
      .eq("is_public", true)
      .is("deleted_at", null)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ note: data });
  } catch (error) {
    console.error("Error fetching public note:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
