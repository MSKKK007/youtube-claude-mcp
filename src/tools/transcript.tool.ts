import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolDeps } from "../types.js";
import { toMcpErrorResult } from "../utils/errors.js";
import { normalizeLanguage } from "../utils/validation.js";
import { requireVideoId } from "../utils/youtube-url.js";
import { okResult } from "./tool-result.js";

export function registerTranscriptTool(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    "get_transcript",
    {
      title: "Get Video Transcript",
      description: "Fetch a public transcript for one specific YouTube video. Returns plain text and optional timestamped segments.",
      inputSchema: {
        urlOrId: z.string().min(1),
        lang: z.string().optional(),
        includeTimestamps: z.boolean().optional()
      },
      annotations: { readOnlyHint: true, idempotentHint: true }
    },
    async (args) => {
      try {
        const videoId = requireVideoId(args.urlOrId);
        const lang = normalizeLanguage(args.lang);
        const transcript = await deps.transcriptClient.fetchTranscript(videoId, lang);
        return okResult(`Fetched ${transcript.segments.length} transcript segments for ${videoId}.`, {
          videoId,
          language: transcript.language,
          source: transcript.source,
          segmentCount: transcript.segments.length,
          text: transcript.text,
          segments: args.includeTimestamps ? transcript.segments : undefined
        });
      } catch (error) {
        return toMcpErrorResult(error);
      }
    }
  );
}
