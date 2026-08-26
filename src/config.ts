import { Config } from "./types.js";

const DEFAULT_PORT = 3000;
const DEFAULT_TIMEOUT_MS = 30_000;

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer`);
  }
  return parsed;
}

function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function loadConfig(): Config {
  const config = {
    serviceName: "youtube-claude-mcp",
    version: "1.0.0",
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: readInt("PORT", DEFAULT_PORT),
    youtubeApiKey: blankToUndefined(process.env.YOUTUBE_API_KEY) ?? "",
    youtubeTimeoutMs: readInt("YOUTUBE_TIMEOUT_MS", DEFAULT_TIMEOUT_MS),
    authMode: (blankToUndefined(process.env.AUTH_MODE) ?? "none") as Config["authMode"],
    authRequiredScope: blankToUndefined(process.env.AUTH_REQUIRED_SCOPE) ?? "youtube:read",
    cacheTtls: {
      transcriptSeconds: readInt("TRANSCRIPT_CACHE_TTL_SECONDS", 604_800),
      videoDetailsSeconds: readInt("VIDEO_DETAILS_CACHE_TTL_SECONDS", 900),
      trendingSeconds: readInt("TRENDING_CACHE_TTL_SECONDS", 600),
      channelVideosSeconds: readInt("CHANNEL_VIDEOS_CACHE_TTL_SECONDS", 600)
    }
  } satisfies Config;
  const authIssuer = blankToUndefined(process.env.AUTH_ISSUER);
  const authAudience = blankToUndefined(process.env.AUTH_AUDIENCE);
  const authJwksUrl = blankToUndefined(process.env.AUTH_JWKS_URL);
  const redisUrl = blankToUndefined(process.env.REDIS_URL);
  const withOptionals: Config = {
    ...config,
    ...(authIssuer ? { authIssuer } : {}),
    ...(authAudience ? { authAudience } : {}),
    ...(authJwksUrl ? { authJwksUrl } : {}),
    ...(redisUrl ? { redisUrl } : {})
  };
  return validateConfig(withOptionals);
}

export function validateConfig(config: Config): Config {
  if (!config.youtubeApiKey) throw new Error("YOUTUBE_API_KEY is required");
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65_535) {
    throw new Error("PORT must be between 1 and 65535");
  }
  if (config.youtubeTimeoutMs <= 0) throw new Error("YOUTUBE_TIMEOUT_MS must be positive");
  if (!["none", "oauth"].includes(config.authMode)) throw new Error("AUTH_MODE must be none or oauth");
  for (const [name, value] of Object.entries(config.cacheTtls)) {
    if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} cache TTL must be positive`);
  }
  if (config.authMode === "oauth") {
    if (!config.authIssuer) throw new Error("AUTH_ISSUER is required when AUTH_MODE=oauth");
    if (!config.authAudience) throw new Error("AUTH_AUDIENCE is required when AUTH_MODE=oauth");
    if (!config.authJwksUrl) throw new Error("AUTH_JWKS_URL is required when AUTH_MODE=oauth");
  }
  return config;
}
