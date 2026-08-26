import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchTranscriptSegments } from "../clients/transcript.client.js";
import { ToolDeps } from "../types.js";
import { toMcpErrorResult } from "../utils/errors.js";
import { normalizeLanguage } from "../utils/validation.js";
import { requireVideoId } from "../utils/youtube-url.js";
import { okResult } from "./tool-result.js";

export function registerSearchTranscriptTool(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    "search_transcript",
    {
      title: "Search Video Transcript",
      description: "Find where a word or phrase appears in a specific YouTube video's public transcript.",
      inputSchema: {
        urlOrId: z.string().min(1),
        query: z.string().min(1),
        lang: z.string().optional()
      },
      annotations: { readOnlyHint: true, idempotentHint: true }
    },
    async (args) => {
      try {
        const videoId = requireVideoId(args.urlOrId);
        const lang = normalizeLanguage(args.lang);
        const transcript = await deps.transcriptClient.fetchTranscript(videoId, lang);
        const hits = searchTranscriptSegments(transcript.segments, args.query);
        return okResult(`Found ${hits.length} transcript matches for "${args.query}".`, {
          videoId,
          language: transcript.language,
          query: args.query,
          hits
        });
      } catch (error) {
        return toMcpErrorResult(error);
      }
    }
  );
}
