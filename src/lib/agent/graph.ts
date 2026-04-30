/**
 * LangGraph 状态图定义 - Agent 核心
 */

import { StateGraph, END, START } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AgentState } from "./state";
import { getChatModel } from "./llm";
import { getAllTools } from "./tools";
import { routerNode, shouldContinue } from "./nodes";

export async function buildAgentGraph(options?: { userId?: string }) {
  const model = await getChatModel({ streaming: true, userId: options?.userId });
  const tools = await getAllTools();
  const modelWithTools = model.bindTools(tools);
  const toolNode = new ToolNode(tools);

  const graph = new StateGraph(AgentState)
    // 节点定义
    .addNode("router", routerNode)
    .addNode("call_model", async (state) => {
      const response = await modelWithTools.invoke(state.messages);
      return {
        messages: [response],
        iterationCount: state.iterationCount + 1,
      };
    })
    .addNode("tools", toolNode)
    // 边定义
    .addEdge(START, "router")
    .addEdge("router", "call_model")
    .addConditionalEdges("call_model", shouldContinue, {
      tools: "tools",
      __end__: END,
    })
    .addEdge("tools", "call_model");

  return graph.compile();
}
