import { describe, expect, it } from "vitest";
import { clampMaxResults, normalizeLanguage, normalizeRegionCode } from "../src/utils/validation.js";

describe("validation utilities", () => {
  it("clamps max results", () => {
    expect(clampMaxResults(undefined, 5, 25)).toBe(5);
    expect(clampMaxResults(99, 5, 25)).toBe(25);
    expect(clampMaxResults(-1, 5, 25)).toBe(1);
  });

  it("normalizes region and language values", () => {
    expect(normalizeRegionCode("pk")).toBe("PK");
    expect(normalizeLanguage("PT-BR")).toBe("pt-br");
    expect(() => normalizeRegionCode("pak")).toThrow();
    expect(() => normalizeLanguage("bad value")).toThrow();
  });
});
