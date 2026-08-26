import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolDeps } from "../types.js";
import { toMcpErrorResult } from "../utils/errors.js";
import { clampMaxResults } from "../utils/validation.js";
import { extractChannelReference } from "../utils/youtube-url.js";
import { okResult } from "./tool-result.js";

export function registerChannelVideosTool(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    "get_channel_videos",
    {
      title: "Get Channel Uploads",
      description: "Get recent uploads from a YouTube channel ID, handle, channel URL, custom URL, or username-like reference.",
      inputSchema: {
        channel: z.string().min(1),
        maxResults: z.number().int().min(1).max(25).optional()
      },
      annotations: { readOnlyHint: true, idempotentHint: true }
    },
    async (args) => {
      try {
        const channel = extractChannelReference(args.channel);
        const maxResults = clampMaxResults(args.maxResults, 10, 25);
        const result = await deps.youtubeClient.getChannelVideos(channel, maxResults);
        return okResult(`Found ${result.videos.length} recent uploads for channel ${result.channelId}.`, result);
      } catch (error) {
        return toMcpErrorResult(error);
      }
    }
  );
}
