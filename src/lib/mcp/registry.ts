import type { McpLangChainTool, McpServerConfig } from "./types";

const MCP_SERVERS: McpServerConfig[] = [
  {
    name: "filesystem",
    enabled: process.env.MCP_FILESYSTEM_ENABLED === "true",
    transport: "stdio",
    command: process.env.MCP_FILESYSTEM_COMMAND,
    args: process.env.MCP_FILESYSTEM_ARGS?.split(" ").filter(Boolean),
  },
  {
    name: "knowledge-web",
    enabled: process.env.MCP_WEB_ENABLED === "true",
    transport: "http",
    url: process.env.MCP_WEB_URL,
  },
];

export function getMcpServerConfigs() {
  return MCP_SERVERS.filter((server) => server.enabled);
}

export async function loadMcpTools(): Promise<McpLangChainTool[]> {
  const servers = getMcpServerConfigs();

  if (servers.length > 0) {
    console.warn(
      "MCP servers are configured, but no concrete MCP SDK adapter is installed yet. Returning local tools only."
    );
  }

  return [];
}
