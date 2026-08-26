import { CacheClient, Config, TranscriptResult, TranscriptSearchHit, TranscriptSegment } from "../types.js";
import { cacheKey } from "../cache/redis-cache.js";
import { fetchJson, fetchText } from "./http-client.js";
import { AppError } from "../utils/errors.js";
import { concatenateTranscript, formatMs } from "../utils/format.js";

interface CaptionTrack {
  baseUrl?: string;
  languageCode?: string;
  name?: { simpleText?: string; runs?: Array<{ text?: string }> };
}

interface PlayerResponse {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
    };
  };
}

export class TranscriptClient {
  constructor(
    private readonly config: Config,
    private readonly cache: CacheClient
  ) {}

  async fetchTranscript(videoId: string, language: string): Promise<TranscriptResult> {
    const key = cacheKey("transcript", videoId, language);
    const cached = await this.cache.getJson<TranscriptResult>(key);
    if (cached) return cached;
    const result = (await this.fetchViaInnerTube(videoId, language)) ?? (await this.fetchViaWebPage(videoId, language));
    if (!result) throw new AppError("No public transcript/caption track is available for this video", "TRANSCRIPT_UNAVAILABLE", 404);
    await this.cache.setJson(key, result, this.config.cacheTtls.transcriptSeconds);
    return result;
  }

  async fetchViaInnerTube(videoId: string, language: string): Promise<TranscriptResult | undefined> {
    const response = await fetchJson<PlayerResponse>(
      "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          context: {
            client: {
              clientName: "WEB",
              clientVersion: "2.20240726.00.00"
            }
          },
          videoId
        })
      },
      this.config.youtubeTimeoutMs
    ).catch(() => undefined);
    const tracks = response?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks?.length) return undefined;
    return this.fetchFromTracks(videoId, tracks, language, "innertube");
  }

  async fetchViaWebPage(videoId: string, language: string): Promise<TranscriptResult | undefined> {
    const response = await fetchText(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {}, this.config.youtubeTimeoutMs);
    if ([403, 429].includes(response.status) || /captcha|unusual traffic|sorry\/index/i.test(response.text)) {
      throw new AppError("YouTube blocked transcript discovery for this request", "YOUTUBE_BLOCKED", response.status);
    }
    if (!response.ok) return undefined;
    const playerResponse = parseInlineJson(response.text);
    const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks?.length) return undefined;
    return this.fetchFromTracks(videoId, tracks, language, "watch-page");
  }

  private async fetchFromTracks(
    videoId: string,
    tracks: CaptionTrack[],
    language: string,
    source: TranscriptResult["source"]
  ): Promise<TranscriptResult | undefined> {
    const selected = selectCaptionTrack(tracks, language);
    if (!selected?.baseUrl) return undefined;
    const response = await fetchText(selected.baseUrl, {}, this.config.youtubeTimeoutMs);
    if ([403, 429].includes(response.status)) {
      throw new AppError("YouTube rate-limited or blocked caption fetching", "YOUTUBE_BLOCKED", response.status);
    }
    if (!response.ok) return undefined;
    const segments = parseTranscriptXml(response.text);
    if (!segments.length) return undefined;
    return {
      videoId,
      language: selected.languageCode ?? language,
      source,
      segments,
      text: concatenateTranscript(segments)
    };
  }
}

export function selectCaptionTrack(tracks: CaptionTrack[], language: string): CaptionTrack | undefined {
  return tracks.find((track) => track.languageCode?.toLowerCase() === language.toLowerCase()) ?? tracks[0];
}

export function parseInlineJson(html: string): PlayerResponse | undefined {
  const marker = "ytInitialPlayerResponse";
  const index = html.indexOf(marker);
  if (index < 0) return undefined;
  const start = html.indexOf("{", index);
  if (start < 0) return undefined;
  let depth = 0;
  for (let i = start; i < html.length; i += 1) {
    const char = html[i];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1)) as PlayerResponse;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export function parseTranscriptXml(xml: string): TranscriptSegment[] {
  const chunks = Array.from(xml.matchAll(/<(text|p)\b([^>]*)>([\s\S]*?)<\/\1>/g));
  return chunks
    .map((match) => {
      const attrs = parseAttrs(match[2] ?? "");
      const start = Number(attrs.start ?? attrs.t ?? 0);
      const dur = Number(attrs.dur ?? attrs.d ?? 0);
      const multiplier = attrs.t !== undefined || attrs.d !== undefined ? 1 : 1000;
      const inner = stripTags(match[3] ?? "");
      const text = decodeEntities(inner).replace(/\s+/g, " ").trim();
      return {
        text,
        offsetMs: Math.round(start * multiplier),
        durationMs: Math.round(dur * multiplier),
        timestamp: formatMs(Math.round(start * multiplier))
      };
    })
    .filter((segment) => segment.text.length > 0);
}

function parseAttrs(attrs: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of attrs.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)="([^"]*)"/g)) {
    if (match[1]) result[match[1]] = match[2] ?? "";
  }
  return result;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "");
}

export function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)));
}

export function searchTranscriptSegments(segments: TranscriptSegment[], query: string): TranscriptSearchHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return segments
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment }) => segment.text.toLowerCase().includes(needle))
    .map(({ segment, index }) => {
      const before = segments[index - 1]?.text;
      const after = segments[index + 1]?.text;
      return {
        text: segment.text,
        timestamp: segment.timestamp,
        offsetMs: segment.offsetMs,
        ...(before ? { before } : {}),
        ...(after ? { after } : {})
      };
    });
}
