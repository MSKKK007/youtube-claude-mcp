import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code = "APP_ERROR",
    public readonly status?: number
  ) {
    super(message);
  }
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Unexpected error";
  return new AppError(sanitize(message));
}

export function toMcpErrorResult(error: unknown): CallToolResult {
  const safe = normalizeError(error);
  return {
    isError: true,
    content: [{ type: "text", text: `${safe.code}: ${safe.message}` }],
    structuredContent: {
      error: {
        code: safe.code,
        message: safe.message,
        status: safe.status
      }
    }
  };
}

export function sanitize(message: string): string {
  return message
    .replace(/key=[^&\s]+/gi, "key=[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted]");
}
