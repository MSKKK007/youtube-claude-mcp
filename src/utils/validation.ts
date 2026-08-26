export function clampMaxResults(value: number | undefined, defaultValue: number, hardMax: number): number {
  const selected = value ?? defaultValue;
  const rounded = Math.round(selected);
  if (!Number.isFinite(rounded)) return defaultValue;
  return Math.min(Math.max(rounded, 1), hardMax);
}

export function normalizeRegionCode(regionCode: string | undefined, defaultRegion = "US"): string {
  const value = (regionCode ?? defaultRegion).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(value)) {
    throw new Error("regionCode must be a two-letter country code such as US or PK");
  }
  return value;
}

export function normalizeLanguage(lang: string | undefined, defaultLanguage = "en"): string {
  const value = (lang ?? defaultLanguage).trim().toLowerCase();
  if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(value)) {
    throw new Error("lang must be a language code such as en, es, or pt-br");
  }
  return value;
}

export function publishedAfterForUploadDate(uploadDate: string | undefined): string | undefined {
  if (!uploadDate || uploadDate === "any") return undefined;
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const offsets: Record<string, number> = {
    hour: 60 * 60 * 1000,
    today: day,
    week: 7 * day,
    month: 30 * day,
    year: 365 * day
  };
  const offset = offsets[uploadDate];
  if (!offset) throw new Error("uploadDate must be any, hour, today, week, month, or year");
  return new Date(now - offset).toISOString();
}
