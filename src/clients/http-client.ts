import { AppError } from "../utils/errors.js";

export interface TextResponse {
  status: number;
  ok: boolean;
  text: string;
  headers: Headers;
}

export async function fetchJson<T>(url: string, options: RequestInit = {}, timeoutMs = 30_000): Promise<T> {
  const response = await fetchWithTimeout(url, options, timeoutMs);
  const text = await response.text();
  if (!response.ok) {
    throw new AppError(`HTTP ${response.status}: ${text.slice(0, 500)}`, "HTTP_ERROR", response.status);
  }
  return JSON.parse(text) as T;
}

export async function fetchText(url: string, options: RequestInit = {}, timeoutMs = 30_000): Promise<TextResponse> {
  const response = await fetchWithTimeout(url, options, timeoutMs);
  return {
    status: response.status,
    ok: response.ok,
    text: await response.text(),
    headers: response.headers
  };
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "user-agent": "youtube-claude-mcp/1.0",
        ...(options.headers ?? {})
      }
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError("Upstream request timed out", "UPSTREAM_TIMEOUT", 504);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
