import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export interface SimpleMcpToolDefinition {
  name: string;
  description?: string;
  call: (input: Record<string, unknown>) => Promise<unknown>;
}

export function adaptSimpleMcpTool(definition: SimpleMcpToolDefinition) {
  return new DynamicStructuredTool({
    name: definition.name,
    description: definition.description || `MCP tool: ${definition.name}`,
    schema: z.record(z.string(), z.unknown()),
    func: async (input) => {
      const result = await definition.call(input);
      return typeof result === "string" ? result : JSON.stringify(result);
    },
  });
}
