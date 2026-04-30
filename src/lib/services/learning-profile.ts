import { SupabaseClient } from "@supabase/supabase-js";
import { getApiClient } from "@/storage/database/supabase-client";

interface ConceptEntry {
  concept: string;
  score: number;
  lastSeen: string;
}

type KeyPoint = {
  point?: string;
  confidence?: number | string;
};

export interface LearningProfileResult {
  weakConcepts: ConceptEntry[];
  strongConcepts: ConceptEntry[];
  interests: string[];
  studyStats: {
    totalNotes: number;
    totalReviews: number;
    avgConfidence: number;
    totalFeedback: number;
  };
}

function createConceptMapEntry(score: number, lastSeen: string) {
  return { score, lastSeen };
}

export async function computeLearningProfile(
  userId: string,
  client: SupabaseClient = getApiClient()
): Promise<LearningProfileResult> {
  const { data: notes } = await client
    .from("notes")
    .select("tags, key_points, updated_at")
    .eq("user_id", userId)
    .is("deleted_at", null);

  const { data: feedbacks } = await client
    .from("knowledge_feedback")
    .select("feedback, original_value, corrected_value, created_at")
    .eq("user_id", userId);

  const { data: reviews } = await client
    .from("flashcard_reviews")
    .select("question, ease_factor, repetitions, last_reviewed")
    .eq("user_id", userId);

  const tagCounts: Record<string, number> = {};
  for (const note of notes || []) {
    const tags = note.tags as string[] | null;
    for (const tag of tags || []) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  const interests = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);

  const weakMap: Record<string, { score: number; lastSeen: string }> = {};
  const strongMap: Record<string, { score: number; lastSeen: string }> = {};

  for (const note of notes || []) {
    const keyPoints = note.key_points as KeyPoint[] | null;
    if (!keyPoints) continue;

    for (const keyPoint of keyPoints) {
      if (typeof keyPoint !== "object" || keyPoint === null || !("point" in keyPoint)) {
        continue;
      }

      const concept = keyPoint.point as string;
      const confidence = Number(keyPoint.confidence ?? 0);
      if (confidence < 0.7) {
        weakMap[concept] = createConceptMapEntry(confidence, note.updated_at);
      } else if (confidence >= 0.8) {
        strongMap[concept] = createConceptMapEntry(confidence, note.updated_at);
      }
    }
  }

  for (const feedback of feedbacks || []) {
    const concept = feedback.original_value || feedback.corrected_value || "";
    if (!concept) continue;

    if (feedback.feedback === "incorrect") {
      weakMap[concept] = createConceptMapEntry(0, feedback.created_at);
      delete strongMap[concept];
    } else if (feedback.feedback === "correct") {
      strongMap[concept] = createConceptMapEntry(1, feedback.created_at);
      delete weakMap[concept];
    }
  }

  for (const review of reviews || []) {
    const concept = review.question || "";
    if (!concept) continue;

    const lastSeen = review.last_reviewed || new Date().toISOString();
    if (review.ease_factor < 2.0 && review.repetitions > 0) {
      weakMap[concept] = createConceptMapEntry(review.ease_factor / 2.5, lastSeen);
    } else if (review.ease_factor >= 2.5 && review.repetitions >= 3) {
      strongMap[concept] = createConceptMapEntry(Math.min(review.ease_factor / 2.5, 1), lastSeen);
    }
  }

  const weakConcepts: ConceptEntry[] = Object.entries(weakMap)
    .sort((a, b) => a[1].score - b[1].score)
    .slice(0, 20)
    .map(([concept, data]) => ({ concept, ...data }));

  const strongConcepts: ConceptEntry[] = Object.entries(strongMap)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 20)
    .map(([concept, data]) => ({ concept, ...data }));

  let avgConfidence = 0;
  let confidenceCount = 0;
  for (const note of notes || []) {
    const keyPoints = note.key_points as KeyPoint[] | null;
    if (!keyPoints) continue;

    for (const keyPoint of keyPoints) {
      if (typeof keyPoint !== "object" || keyPoint === null || !("confidence" in keyPoint)) {
        continue;
      }

      avgConfidence += Number(keyPoint.confidence ?? 0);
      confidenceCount++;
    }
  }

  const studyStats = {
    totalNotes: notes?.length || 0,
    totalReviews: reviews?.filter((review) => review.last_reviewed)?.length || 0,
    avgConfidence: confidenceCount > 0 ? avgConfidence / confidenceCount : 0,
    totalFeedback: feedbacks?.length || 0,
  };

  return { weakConcepts, strongConcepts, interests, studyStats };
}

export async function getOrCreateLearningProfile(
  userId: string,
  options?: { forceRecompute?: boolean; client?: SupabaseClient }
) {
  const client = options?.client || getApiClient();

  if (!options?.forceRecompute) {
    const { data: profile } = await client
      .from("user_learning_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (profile) {
      return profile;
    }
  }

  const computed = await computeLearningProfile(userId, client);
  const payload = {
    user_id: userId,
    weak_concepts: computed.weakConcepts,
    strong_concepts: computed.strongConcepts,
    interests: computed.interests,
    study_stats: computed.studyStats,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await client
    .from("user_learning_profiles")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (existing) {
    await client.from("user_learning_profiles").update(payload).eq("user_id", userId);
  } else {
    await client.from("user_learning_profiles").insert(payload);
  }

  return payload;
}
