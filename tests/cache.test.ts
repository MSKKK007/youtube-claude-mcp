import { describe, expect, it } from "vitest";
import { NoopCache, cacheKey } from "../src/cache/redis-cache.js";

describe("cache utilities", () => {
  it("encodes stable cache keys", () => {
    expect(cacheKey("transcript", "a b", undefined)).toBe("transcript:a%20b:none");
  });

  it("noop cache is safe", async () => {
    const cache = new NoopCache();
    await expect(cache.setJson("x", { ok: true }, 1)).resolves.toBeUndefined();
    await expect(cache.getJson("x")).resolves.toBeUndefined();
    await expect(cache.ping()).resolves.toBe(true);
  });
});
