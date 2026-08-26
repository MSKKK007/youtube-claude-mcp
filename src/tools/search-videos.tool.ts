import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolDeps } from "../types.js";
import { toMcpErrorResult } from "../utils/errors.js";
import { clampMaxResults, normalizeRegionCode } from "../utils/validation.js";
import { okResult } from "./tool-result.js";

export function registerSearchVideosTool(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    "search_videos",
    {
      title: "Search YouTube Videos",
      description: "Discover YouTube videos from a topic query. Use this for finding videos, not for details about a specific known video.",
      inputSchema: {
        query: z.string().min(1),
        maxResults: z.number().int().min(1).max(25).optional(),
        order: z.enum(["date", "rating", "relevance", "title", "viewCount"]).optional(),
        duration: z.enum(["any", "short", "medium", "long"]).optional(),
        uploadDate: z.enum(["any", "hour", "today", "week", "month", "year"]).optional(),
        regionCode: z.string().optional()
      },
      annotations: { readOnlyHint: true, idempotentHint: true }
    },
    async (args) => {
      try {
        const maxResults = clampMaxResults(args.maxResults, 5, 25);
        const regionCode = args.regionCode ? normalizeRegionCode(args.regionCode) : undefined;
        const videos = await deps.youtubeClient.searchVideos({
          query: args.query,
          maxResults,
          ...(args.order ? { order: args.order } : {}),
          ...(args.duration ? { duration: args.duration } : {}),
          ...(args.uploadDate ? { uploadDate: args.uploadDate } : {}),
          ...(regionCode ? { regionCode } : {})
        });
        return okResult(`Found ${videos.length} YouTube videos for "${args.query}".`, { videos });
      } catch (error) {
        return toMcpErrorResult(error);
      }
    }
  );
}
