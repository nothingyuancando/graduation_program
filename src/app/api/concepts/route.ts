import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getApiClient } from "@/storage/database/supabase-client";
import { getOrCreateLearningProfile } from "@/lib/services/learning-profile";

type NoteRow = {
  id: string;
  title: string;
  content?: string | null;
  subject?: string | null;
  updated_at?: string | null;
};

type EntityRow = {
  entity_name?: string | null;
  entity_type?: string | null;
  note_id: string;
  description?: string | null;
  confidence?: string | number | null;
  created_at?: string | null;
};

type ConceptScore = {
  concept: string;
  score?: number;
};

type ProfileShape = {
  weak_concepts?: ConceptScore[];
  strong_concepts?: ConceptScore[];
};

type ConceptAccumulator = {
  name: string;
  type: string;
  descriptions: Set<string>;
  noteIds: Set<string>;
  subjects: Set<string>;
  confidenceTotal: number;
  confidenceCount: number;
  latestUpdatedAt: string | null;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function extractWikiLinks(content?: string | null) {
  if (!content) return [];
  const matches = content.matchAll(/\[\[([^\]\n]+)\]\]/g);
  return [...matches].map((match) => match[1].trim()).filter(Boolean);
}

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const client = getApiClient();
    const { searchParams } = new URL(request.url);
    const query = normalize(searchParams.get("q") || "");

    const { data: notes, error: notesError } = await client
      .from("notes")
      .select("id, title, content, subject, updated_at")
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (notesError) throw notesError;

    const typedNotes = (notes || []) as NoteRow[];
    const noteMap = new Map(typedNotes.map((note) => [note.id, note]));
    const noteIds = [...noteMap.keys()];

    if (noteIds.length === 0) {
      return NextResponse.json({ concepts: [] });
    }

    const { data: entities, error } = await client
      .from("note_entities")
      .select("entity_name, entity_type, note_id, description, confidence, created_at")
      .in("note_id", noteIds)
      .limit(1000);

    if (error) throw error;

    const profile = (await getOrCreateLearningProfile(user.id, { client })) as ProfileShape;
    const weakConcepts = profile.weak_concepts || [];
    const strongConcepts = profile.strong_concepts || [];

    const weakMap = new Map(weakConcepts.map((item) => [normalize(item.concept || ""), item]));
    const strongMap = new Map(strongConcepts.map((item) => [normalize(item.concept || ""), item]));
    const concepts = new Map<string, ConceptAccumulator>();

    for (const entity of ((entities || []) as EntityRow[])) {
      const name = String(entity.entity_name || "").trim();
      if (!name) continue;
      if (query && !normalize(name).includes(query)) continue;

      const key = normalize(name);
      const note = noteMap.get(entity.note_id);
      const current = concepts.get(key) || {
        name,
        type: entity.entity_type || "concept",
        descriptions: new Set<string>(),
        noteIds: new Set<string>(),
        subjects: new Set<string>(),
        confidenceTotal: 0,
        confidenceCount: 0,
        latestUpdatedAt: null as string | null,
      };

      current.noteIds.add(entity.note_id);
      if (entity.description) current.descriptions.add(entity.description);
      if (note?.subject) current.subjects.add(note.subject);
      if (entity.confidence != null) {
        current.confidenceTotal += Number(entity.confidence || 0);
        current.confidenceCount += 1;
      }
      if (!current.latestUpdatedAt || (note?.updated_at || "") > current.latestUpdatedAt) {
        current.latestUpdatedAt = note?.updated_at || null;
      }
      concepts.set(key, current);
    }

    for (const note of typedNotes) {
      for (const name of extractWikiLinks(note.content)) {
        if (query && !normalize(name).includes(query)) continue;

        const key = normalize(name);
        const current = concepts.get(key) || {
          name,
          type: "wiki-link",
          descriptions: new Set<string>(),
          noteIds: new Set<string>(),
          subjects: new Set<string>(),
          confidenceTotal: 0,
          confidenceCount: 0,
          latestUpdatedAt: null as string | null,
        };

        current.noteIds.add(note.id);
        if (note.subject) current.subjects.add(note.subject);
        if (!current.latestUpdatedAt || (note.updated_at || "") > current.latestUpdatedAt) {
          current.latestUpdatedAt = note.updated_at || null;
        }
        concepts.set(key, current);
      }
    }

    const result = [...concepts.entries()]
      .map(([key, item]) => {
        const weak = weakMap.get(key);
        const strong = strongMap.get(key);
        return {
          name: item.name,
          type: item.type,
          description: [...item.descriptions][0] || "",
          noteCount: item.noteIds.size,
          subjects: [...item.subjects],
          avgConfidence: item.confidenceCount > 0 ? item.confidenceTotal / item.confidenceCount : null,
          latestUpdatedAt: item.latestUpdatedAt,
          learningState: weak ? "weak" : strong ? "strong" : "unknown",
          masteryScore: strong?.score ?? (weak?.score != null ? 1 - weak.score : null),
        };
      })
      .sort((a, b) => {
        if (a.learningState === "weak" && b.learningState !== "weak") return -1;
        if (a.learningState !== "weak" && b.learningState === "weak") return 1;
        return b.noteCount - a.noteCount || a.name.localeCompare(b.name);
      });

    return NextResponse.json({ concepts: result });
  } catch (error) {
    console.error("Error fetching concepts:", error);
    return NextResponse.json({ error: "获取概念列表失败" }, { status: 500 });
  }
}
