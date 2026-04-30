/**
 * 统一导出所有 LangChain 工具
 */

import { searchNotesTool } from "./search-notes";
import { getNoteDetailTool } from "./get-note-detail";
import { getLearningProfileTool } from "./get-learning-profile";
import { getUserSkillsTool } from "./get-user-skills";
import { getRelatedNotesTool } from "./get-related-notes";
import { analyzeNoteTool } from "./analyze-note";
import { generateQuizTool } from "./generate-quiz";
import { classifyNoteSubjectTool } from "./classify-note-subject";
import { batchClassifyNotesTool } from "./batch-classify-notes";
import { getSubjectOverviewTool } from "./get-subject-overview";
import { generateLearningPathTool } from "./generate-learning-path";
import { loadMcpTools } from "@/lib/mcp";

export const allTools = [
  searchNotesTool,
  getNoteDetailTool,
  getLearningProfileTool,
  getUserSkillsTool,
  getRelatedNotesTool,
  analyzeNoteTool,
  generateQuizTool,
  classifyNoteSubjectTool,
  batchClassifyNotesTool,
  getSubjectOverviewTool,
  generateLearningPathTool,
];

export async function getAllTools() {
  const mcpTools = await loadMcpTools();
  return [...allTools, ...mcpTools];
}

export {
  searchNotesTool,
  getNoteDetailTool,
  getLearningProfileTool,
  getUserSkillsTool,
  getRelatedNotesTool,
  analyzeNoteTool,
  generateQuizTool,
  classifyNoteSubjectTool,
  batchClassifyNotesTool,
  getSubjectOverviewTool,
  generateLearningPathTool,
};
