import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolDeps } from "../types.js";
import { toMcpErrorResult } from "../utils/errors.js";
import { clampMaxResults, normalizeRegionCode } from "../utils/validation.js";
import { okResult } from "./tool-result.js";

export function registerTrendingVideosTool(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    "get_trending_videos",
    {
      title: "Get Trending YouTube Videos",
      description: "Get popular YouTube videos by country and optional YouTube category. Use for what is popular or trending now.",
      inputSchema: {
        regionCode: z.string().optional(),
        categoryId: z.string().optional(),
        maxResults: z.number().int().min(1).max(25).optional()
      },
      annotations: { readOnlyHint: true, idempotentHint: true }
    },
    async (args) => {
      try {
        const regionCode = normalizeRegionCode(args.regionCode);
        const maxResults = clampMaxResults(args.maxResults, 10, 25);
        const videos = await deps.youtubeClient.getTrendingVideos({
          regionCode,
          maxResults,
          ...(args.categoryId ? { categoryId: args.categoryId } : {})
        });
        return okResult(`Found ${videos.length} popular YouTube videos for ${regionCode}.`, { regionCode, videos });
      } catch (error) {
        return toMcpErrorResult(error);
      }
    }
  );
}
