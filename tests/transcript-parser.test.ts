import { describe, expect, it } from "vitest";
import { decodeEntities, parseInlineJson, parseTranscriptXml, searchTranscriptSegments } from "../src/clients/transcript.client.js";

describe("transcript parser", () => {
  it("parses classic text caption XML", () => {
    const segments = parseTranscriptXml('<transcript><text start="1.5" dur="2">Hello &amp; welcome</text></transcript>');
    expect(segments).toEqual([{ text: "Hello & welcome", offsetMs: 1500, durationMs: 2000, timestamp: "0:01" }]);
  });

  it("parses p/s style caption XML", () => {
    const segments = parseTranscriptXml('<timedtext><p t="1200" d="800"><s>Nested</s> words</p></timedtext>');
    expect(segments[0]).toMatchObject({ text: "Nested words", offsetMs: 1200, durationMs: 800 });
  });

  it("extracts inline player response JSON", () => {
    const parsed = parseInlineJson('abc ytInitialPlayerResponse = {"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[{"languageCode":"en"}]}}};');
    expect(parsed?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.[0]?.languageCode).toBe("en");
  });

  it("searches transcript segments with context", () => {
    const segments = parseTranscriptXml(
      '<transcript><text start="0" dur="1">before</text><text start="2" dur="1">OAuth setup happens here</text><text start="4" dur="1">after</text></transcript>'
    );
    expect(searchTranscriptSegments(segments, "oauth")).toEqual([
      { text: "OAuth setup happens here", timestamp: "0:02", offsetMs: 2000, before: "before", after: "after" }
    ]);
  });

  it("decodes numeric entities", () => {
    expect(decodeEntities("A&#39;B &#x26; C")).toBe("A'B & C");
  });
});
