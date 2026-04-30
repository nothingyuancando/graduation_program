import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";
import { analyzeNoteById } from "@/lib/services/note-analysis";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;

  try {
    const user = getUserFromRequest(request);
    const client = getApiClient();

    const analysis = await analyzeNoteById(id, {
      client,
      userId: user?.id,
      origin: request.nextUrl.origin,
      cookie: request.headers.get("cookie") || "",
    });

    return NextResponse.json({
      analysis,
      message: "Analysis completed successfully",
    });
  } catch (error) {
    console.error("Error analyzing note:", error);

    try {
      const client = getApiClient();
      await client.from("notes").update({ status: "draft" }).eq("id", id);
    } catch (updateError) {
      console.error("Error updating note status:", updateError);
    }

    return NextResponse.json(
      { error: "Failed to analyze note" },
      { status: 500 }
    );
  }
}
