import { ParsedYouTubeInput } from "../types.js";

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const CHANNEL_ID_RE = /^UC[a-zA-Z0-9_-]{22}$/;

export function parseTimestampToSeconds(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().toLowerCase();
  if (/^\d+s?$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(trimmed);
  if (!match) return undefined;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : undefined;
}

export function parseYouTubeInput(input: string): ParsedYouTubeInput {
  const raw = input.trim();
  if (VIDEO_ID_RE.test(raw)) return { type: "video", videoId: raw, raw };
  if (CHANNEL_ID_RE.test(raw)) return { type: "channel", channelId: raw, raw };
  if (/^@[a-zA-Z0-9._-]+$/.test(raw)) return { type: "handle", handle: raw, raw };

  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
    const path = url.pathname.split("/").filter(Boolean);
    const timestampSec = parseTimestampToSeconds(url.searchParams.get("t") ?? url.searchParams.get("start") ?? undefined);

    if (host === "youtu.be" && path[0] && VIDEO_ID_RE.test(path[0])) {
      return withTimestamp({ type: "video", videoId: path[0], raw }, timestampSec);
    }
    if (!["youtube.com", "youtube-nocookie.com"].includes(host)) return { type: "unknown", raw };

    const watchId = url.searchParams.get("v") ?? undefined;
    if (watchId && VIDEO_ID_RE.test(watchId)) return withTimestamp({ type: "video", videoId: watchId, raw }, timestampSec);

    if (["shorts", "embed", "live"].includes(path[0] ?? "") && path[1] && VIDEO_ID_RE.test(path[1])) {
      return withTimestamp({ type: "video", videoId: path[1], raw }, timestampSec);
    }
    const playlistId = url.searchParams.get("list") ?? undefined;
    if ((path[0] === "playlist" || playlistId) && playlistId) return { type: "playlist", playlistId, raw };
    if (path[0] === "channel" && path[1]) return { type: "channel", channelId: path[1], raw };
    if (path[0]?.startsWith("@")) return { type: "handle", handle: path[0], raw };
    if ((path[0] === "c" || path[0] === "user") && path[1]) return { type: "handle", handle: path[1], raw };
  } catch {
    return { type: "unknown", raw };
  }

  return { type: "unknown", raw };
}

function withTimestamp(parsed: ParsedYouTubeInput, timestampSec: number | undefined): ParsedYouTubeInput {
  return timestampSec === undefined ? parsed : { ...parsed, timestampSec };
}

export function extractVideoId(input: string): string | undefined {
  return parseYouTubeInput(input).videoId;
}

export function requireVideoId(input: string): string {
  const videoId = extractVideoId(input);
  if (!videoId) throw new Error("A valid YouTube video URL or 11-character video ID is required");
  return videoId;
}

export function extractChannelReference(input: string): string {
  const trimmed = input.trim();
  if (CHANNEL_ID_RE.test(trimmed) || trimmed.startsWith("@")) return trimmed;
  const parsed = parseYouTubeInput(trimmed);
  return parsed.channelId ?? parsed.handle ?? trimmed;
}
