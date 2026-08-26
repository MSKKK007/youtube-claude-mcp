import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "authorization",
      "token",
      "*.token",
      "youtubeApiKey",
      "YOUTUBE_API_KEY",
      "apiKey",
      "*.apiKey"
    ],
    censor: "[redacted]"
  }
});
