import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getApiClient } from "@/storage/database/supabase-client";
import { getOrCreateLearningProfile } from "@/lib/services/learning-profile";

type KeyPoint = {
  point?: string;
  sourceQuote?: string;
  confidence?: number;
};

type NoteRow = {
  id: string;
  title: string;
  summary?: string | null;
  content?: string | null;
  subject?: string | null;
  tags?: string[] | null;
  key_points?: Array<string | KeyPoint> | null;
  updated_at?: string | null;
};

type EntityRow = {
  id?: string;
  note_id: string;
  entity_name?: string | null;
  entity_type?: string | null;
  description?: string | null;
  confidence?: string | number | null;
};

type ConceptScore = {
  concept: string;
  score?: number;
};

type ProfileShape = {
  weak_concepts?: ConceptScore[];
  strong_concepts?: ConceptScore[];
};

type AttemptRow = {
  score?: string | number | null;
  weak_points?: string[] | null;
  completed_at?: string | null;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function includesConcept(value: unknown, concept: string) {
  if (typeof value !== "string") return false;
  return normalize(value).includes(normalize(concept));
}

function hasWikiLink(content: string | null | undefined, concept: string) {
  if (!content) return false;
  const target = normalize(concept);
  for (const match of content.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
    if (normalize(match[1]) === target) return true;
  }
  return false;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const { name } = await params;
    const conceptName = decodeURIComponent(name);
    const client = getApiClient();

    const { data: notes, error: notesError } = await client
      .from("notes")
      .select("id, title, summary, content, subject, tags, key_points, updated_at")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .limit(200);

    if (notesError) throw notesError;

    const typedNotes = (notes || []) as NoteRow[];
    const noteIds = typedNotes.map((note) => note.id);
    const { data: entities, error: entityError } = noteIds.length
      ? await client
          .from("note_entities")
          .select("*")
          .in("note_id", noteIds)
          .ilike("entity_name", `%${conceptName}%`)
          .limit(200)
      : { data: [], error: null };

    if (entityError) throw entityError;

    const typedEntities = (entities || []) as EntityRow[];
    const entityNoteIds = new Set(typedEntities.map((entity) => entity.note_id));
    const backlinks = typedNotes
      .filter((note) => {
        if (entityNoteIds.has(note.id)) return true;
        if (includesConcept(note.title, conceptName)) return true;
        if (includesConcept(note.summary, conceptName)) return true;
        if (hasWikiLink(note.content, conceptName)) return true;
        if (Array.isArray(note.tags) && note.tags.some((tag: string) => includesConcept(tag, conceptName))) return true;
        if (Array.isArray(note.key_points)) {
          return note.key_points.some((item) => {
            const point = typeof item === "string" ? item : item?.point;
            return includesConcept(point, conceptName);
          });
        }
        return false;
      })
      .map((note) => {
        const matchingEntities = typedEntities.filter((entity) => entity.note_id === note.id);
        const matchingKeyPoints = Array.isArray(note.key_points)
          ? note.key_points
              .map((item) => (typeof item === "string" ? { point: item } : item))
              .filter((item) => includesConcept(item?.point, conceptName))
              .slice(0, 3)
          : [];

        return {
          id: note.id,
          title: note.title,
          summary: note.summary,
          subject: note.subject,
          tags: note.tags || [],
          updatedAt: note.updated_at,
          matchingEntities,
          matchingKeyPoints,
        };
      })
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

    const relatedConcepts = new Map<string, { name: string; type: string; count: number }>();
    if (backlinks.length > 0) {
      const backlinkIds = backlinks.map((note) => note.id);
      const { data: relatedEntities } = await client
        .from("note_entities")
        .select("entity_name, entity_type, note_id")
        .in("note_id", backlinkIds)
        .limit(500);

      for (const entity of ((relatedEntities || []) as EntityRow[])) {
        const relatedName = String(entity.entity_name || "").trim();
        if (!relatedName || normalize(relatedName) === normalize(conceptName)) continue;
        const key = normalize(relatedName);
        const current = relatedConcepts.get(key) || {
          name: relatedName,
          type: entity.entity_type || "concept",
          count: 0,
        };
        current.count += 1;
        relatedConcepts.set(key, current);
      }
    }

    const profile = (await getOrCreateLearningProfile(user.id, { client })) as ProfileShape;
    const weakConcept = (profile.weak_concepts || []).find((item) =>
      includesConcept(item?.concept, conceptName) || includesConcept(conceptName, item?.concept)
    );
    const strongConcept = (profile.strong_concepts || []).find((item) =>
      includesConcept(item?.concept, conceptName) || includesConcept(conceptName, item?.concept)
    );

    const { data: attempts } = await client
      .from("quiz_attempts")
      .select("score, weak_points, completed_at")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false })
      .limit(30);

    const relatedAttempts = ((attempts || []) as AttemptRow[]).filter((attempt) =>
      (attempt.weak_points || []).some((point: string) => includesConcept(point, conceptName))
    );

    return NextResponse.json({
      concept: {
        name: conceptName,
        description: typedEntities.find((entity) => entity.description)?.description || "",
        learningState: weakConcept ? "weak" : strongConcept ? "strong" : "unknown",
        masteryScore: strongConcept?.score ?? (weakConcept?.score != null ? 1 - weakConcept.score : null),
        noteCount: backlinks.length,
        quizWeakCount: relatedAttempts.length,
      },
      backlinks,
      relatedConcepts: [...relatedConcepts.values()]
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, 24),
    });
  } catch (error) {
    console.error("Error fetching concept detail:", error);
    return NextResponse.json({ error: "获取概念详情失败" }, { status: 500 });
  }
}
