import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolDeps } from "../types.js";
import { registerChannelVideosTool } from "./channel-videos.tool.js";
import { registerEngagementTool } from "./engagement.tool.js";
import { registerSearchTranscriptTool } from "./search-transcript.tool.js";
import { registerSearchVideosTool } from "./search-videos.tool.js";
import { registerTranscriptTool } from "./transcript.tool.js";
import { registerTrendingVideosTool } from "./trending-videos.tool.js";
import { registerVideoDetailsTool } from "./video-details.tool.js";

export function registerAllTools(server: McpServer, deps: ToolDeps): void {
  registerSearchVideosTool(server, deps);
  registerTrendingVideosTool(server, deps);
  registerChannelVideosTool(server, deps);
  registerVideoDetailsTool(server, deps);
  registerEngagementTool(server, deps);
  registerTranscriptTool(server, deps);
  registerSearchTranscriptTool(server, deps);
}
