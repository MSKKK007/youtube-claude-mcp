import { Redis } from "ioredis";
import { CacheClient } from "../types.js";
import { logger } from "../observability/logger.js";

export class NoopCache implements CacheClient {
  async getJson<T>(): Promise<T | undefined> {
    return undefined;
  }

  async setJson(): Promise<void> {
    return;
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {
    return;
  }
}

export class RedisCache implements CacheClient {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false
    });
    this.redis.on("error", (error: Error) => logger.warn({ err: error }, "redis cache error"));
  }

  async getJson<T>(key: string): Promise<T | undefined> {
    try {
      if (this.redis.status === "wait") await this.redis.connect();
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch (error) {
      logger.warn({ err: error, key }, "redis cache get failed");
      return undefined;
    }
  }

  async setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      if (this.redis.status === "wait") await this.redis.connect();
      await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (error) {
      logger.warn({ err: error, key }, "redis cache set failed");
    }
  }

  async ping(): Promise<boolean> {
    try {
      if (this.redis.status === "wait") await this.redis.connect();
      return (await this.redis.ping()) === "PONG";
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    this.redis.disconnect();
  }
}

export function createCache(redisUrl: string | undefined): CacheClient {
  return redisUrl ? new RedisCache(redisUrl) : new NoopCache();
}

export function cacheKey(...parts: Array<string | number | undefined | null>): string {
  return parts.map((part) => encodeURIComponent(String(part ?? "none"))).join(":");
}
