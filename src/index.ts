import http from "node:http";
import { createCache } from "./cache/redis-cache.js";
import { YouTubeApiClient } from "./clients/youtube-api.client.js";
import { TranscriptClient } from "./clients/transcript.client.js";
import { loadConfig } from "./config.js";
import { createHttpApp } from "./http-app.js";
import { logger } from "./observability/logger.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const cache = createCache(config.redisUrl);
  const youtubeClient = new YouTubeApiClient(config, cache);
  const transcriptClient = new TranscriptClient(config, cache);
  const app = createHttpApp(config, { youtubeClient, transcriptClient, cache });
  const server = http.createServer(app);

  server.requestTimeout = config.youtubeTimeoutMs + 10_000;
  server.headersTimeout = config.youtubeTimeoutMs + 15_000;

  server.listen(config.port, () => {
    logger.info(
      {
        service: config.serviceName,
        version: config.version,
        port: config.port,
        nodeEnv: config.nodeEnv,
        authMode: config.authMode,
        redis: config.redisUrl ? "enabled" : "disabled"
      },
      "service started"
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "shutdown started");
    server.close(async () => {
      await cache.close();
      logger.info("shutdown complete");
      process.exit(0);
    });
    setTimeout(() => {
      logger.error("forced shutdown after timeout");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  logger.error({ err: error }, "startup failed");
  process.exit(1);
});
