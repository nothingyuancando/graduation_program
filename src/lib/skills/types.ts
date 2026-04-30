export interface SkillInput {
  userId: string;
  noteId?: string;
  title?: string;
  content?: string;
  summary?: string | null;
  tags?: string[];
  themes?: Array<{ name: string; importance?: number }>;
  subjectCandidates?: string[];
  intent: string;
  metadata?: Record<string, unknown>;
}

export interface SkillResult<TData extends Record<string, unknown> = Record<string, unknown>> {
  skillId: string;
  success: boolean;
  data: TData;
  confidence?: number;
  message?: string;
}

export interface LearningSkill<TData extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  name: string;
  description: string;
  subjects?: string[];
  intents: string[];
  canHandle(input: SkillInput): Promise<number>;
  run(input: SkillInput): Promise<SkillResult<TData>>;
}
