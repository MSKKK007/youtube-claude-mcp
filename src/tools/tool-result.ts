import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function okResult<T>(summary: string, structuredContent: T): CallToolResult {
  return {
    content: [{ type: "text", text: summary }],
    structuredContent: structuredContent as Record<string, unknown>
  };
}
