import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolDeps } from "../types.js";
import { toMcpErrorResult } from "../utils/errors.js";
import { formatNumber } from "../utils/format.js";
import { requireVideoId } from "../utils/youtube-url.js";
import { okResult } from "./tool-result.js";

export function registerVideoDetailsTool(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    "get_video_details",
    {
      title: "Get Video Details",
      description: "Get metadata and public statistics for one specific YouTube video URL or video ID.",
      inputSchema: { urlOrId: z.string().min(1) },
      annotations: { readOnlyHint: true, idempotentHint: true }
    },
    async (args) => {
      try {
        const videoId = requireVideoId(args.urlOrId);
        const video = await deps.youtubeClient.getVideoDetails(videoId);
        return okResult(`${video.title}: ${formatNumber(video.views)} views, ${video.duration ?? "unknown duration"}.`, { video });
      } catch (error) {
        return toMcpErrorResult(error);
      }
    }
  );
}
