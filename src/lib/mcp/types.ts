import type { DynamicStructuredTool } from "@langchain/core/tools";

export interface McpServerConfig {
  name: string;
  enabled: boolean;
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
}

export type McpLangChainTool = DynamicStructuredTool;
