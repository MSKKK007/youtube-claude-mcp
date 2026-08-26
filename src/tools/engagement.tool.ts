import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolDeps } from "../types.js";
import { toMcpErrorResult } from "../utils/errors.js";
import { requireVideoId } from "../utils/youtube-url.js";
import { okResult } from "./tool-result.js";

export function registerEngagementTool(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    "get_engagement_stats",
    {
      title: "Get Video Engagement Stats",
      description: "Calculate public engagement rates for one specific YouTube video using views, likes, and comments.",
      inputSchema: { urlOrId: z.string().min(1) },
      annotations: { readOnlyHint: true, idempotentHint: true }
    },
    async (args) => {
      try {
        const videoId = requireVideoId(args.urlOrId);
        const stats = await deps.youtubeClient.getEngagementStats(videoId);
        return okResult(`Engagement stats calculated for "${stats.title}".`, { stats });
      } catch (error) {
        return toMcpErrorResult(error);
      }
    }
  );
}
