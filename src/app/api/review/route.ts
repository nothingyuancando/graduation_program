import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

type Flashcard = {
  question: string;
  answer: string;
};

type FlashcardReviewInsert = {
  user_id: string;
  note_id: string;
  card_index: number;
  question: string;
  answer: string;
  due_date: string;
};

type DueCard = {
  id: string;
  note_id: string;
  card_index: number;
  question?: string | null;
  answer?: string | null;
  ease_factor?: number | string | null;
  interval_days?: number | null;
  repetitions?: number | null;
  due_date?: string | null;
  priority?: "high" | "normal";
};

type WeakConcept = {
  concept?: string;
};

async function loadDueCards(client: ReturnType<typeof getApiClient>, userId: string) {
  const now = new Date().toISOString();
  const { data: due, error } = await client
    .from("flashcard_reviews")
    .select("id, note_id, card_index, question, answer, ease_factor, interval_days, repetitions, due_date")
    .eq("user_id", userId)
    .lte("due_date", now)
    .order("due_date", { ascending: true })
    .limit(50);

  if (error) throw error;

  let sortedCards: DueCard[] = (due || []) as DueCard[];
  const { data: profile } = await client
    .from("user_learning_profiles")
    .select("weak_concepts")
    .eq("user_id", userId)
    .single();

  if (profile?.weak_concepts && sortedCards.length > 0) {
    const weakConcepts = (profile.weak_concepts as WeakConcept[]).map((item) =>
      (item.concept || "").toLowerCase()
    );
    sortedCards = sortedCards.map((card) => {
      const question = (card.question || "").toLowerCase();
      const matchesWeak = weakConcepts.some((concept) => question.includes(concept) || concept.includes(question));
      return { ...card, priority: matchesWeak ? "high" : "normal" };
    });
    sortedCards.sort((a, b) => {
      if (a.priority === "high" && b.priority !== "high") return -1;
      if (a.priority !== "high" && b.priority === "high") return 1;
      return 0;
    });
  }

  return sortedCards;
}

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const client = getApiClient();
  const { searchParams } = new URL(request.url);
  const dueOnly = searchParams.get("dueOnly") === "1";

  try {
    if (dueOnly) {
      const cards = await loadDueCards(client, user.id);
      return NextResponse.json({ cards, totalCards: cards.length });
    }

    const { data: notes } = await client
      .from("notes")
      .select("id, title, flashcards")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .not("flashcards", "is", null);

    const toInsert: FlashcardReviewInsert[] = [];
    for (const note of notes || []) {
      const cards = note.flashcards as Flashcard[] | null;
      if (!cards?.length) continue;
      cards.forEach((card, index) => {
        toInsert.push({
          user_id: user.id,
          note_id: note.id,
          card_index: index,
          question: card.question,
          answer: card.answer,
          due_date: new Date().toISOString(),
        });
      });
    }

    if (toInsert.length > 0) {
      await client
        .from("flashcard_reviews")
        .upsert(toInsert, { onConflict: "user_id,note_id,card_index", ignoreDuplicates: true });
    }

    const cards = await loadDueCards(client, user.id);
    const { count } = await client
      .from("flashcard_reviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    return NextResponse.json({ cards, totalCards: count ?? 0 });
  } catch (error) {
    console.error("Error fetching review cards:", error);
    const message = error instanceof Error ? error.message : "获取复习卡片失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
