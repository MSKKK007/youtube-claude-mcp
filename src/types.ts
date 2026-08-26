export type AuthMode = "none" | "oauth";

export interface CacheTtlConfig {
  transcriptSeconds: number;
  videoDetailsSeconds: number;
  trendingSeconds: number;
  channelVideosSeconds: number;
}

export interface Config {
  serviceName: string;
  version: string;
  nodeEnv: string;
  port: number;
  youtubeApiKey: string;
  youtubeTimeoutMs: number;
  authMode: AuthMode;
  authIssuer?: string;
  authAudience?: string;
  authJwksUrl?: string;
  authRequiredScope?: string;
  redisUrl?: string;
  cacheTtls: CacheTtlConfig;
}

export interface VideoSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  description: string;
  thumbnailUrl?: string;
  url: string;
}

export interface VideoDetails extends VideoSearchResult {
  duration?: string;
  durationIso?: string;
  views: number;
  likes: number | null;
  comments: number | null;
  tags: string[];
  categoryId?: string;
}

export interface EngagementStats {
  videoId: string;
  title: string;
  views: number;
  likes: number | null;
  comments: number | null;
  likeRate: number | null;
  commentRate: number | null;
  engagementRate: number | null;
}

export interface TranscriptSegment {
  text: string;
  offsetMs: number;
  durationMs: number;
  timestamp: string;
}

export interface TranscriptResult {
  videoId: string;
  language: string;
  source: "innertube" | "watch-page";
  segments: TranscriptSegment[];
  text: string;
}

export interface TranscriptSearchHit {
  text: string;
  timestamp: string;
  offsetMs: number;
  before?: string;
  after?: string;
}

export interface ParsedYouTubeInput {
  type: "video" | "channel" | "handle" | "playlist" | "unknown";
  videoId?: string;
  channelId?: string;
  handle?: string;
  playlistId?: string;
  timestampSec?: number;
  raw: string;
}

export interface ValidatedAuthInfo {
  subject: string;
  issuer: string;
  audience: string | string[];
  scopes: string[];
}

export interface ToolDeps {
  youtubeClient: import("./clients/youtube-api.client.js").YouTubeApiClient;
  transcriptClient: import("./clients/transcript.client.js").TranscriptClient;
}

export interface CacheClient {
  getJson<T>(key: string): Promise<T | undefined>;
  setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}
