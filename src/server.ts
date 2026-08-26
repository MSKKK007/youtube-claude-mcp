import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Config, ToolDeps } from "./types.js";
import { registerAllTools } from "./tools/register-tools.js";

export function createYouTubeMcpServer(config: Config, deps: ToolDeps): McpServer {
  const server = new McpServer(
    {
      name: config.serviceName,
      version: config.version
    },
    {
      instructions:
        "Read-only YouTube tools for Claude.ai. Use these tools for public YouTube search, trending videos, channel uploads, video metadata, engagement calculations, and public transcripts. Never use these tools for private YouTube account data or actions."
    }
  );
  registerAllTools(server, deps);
  return server;
}
