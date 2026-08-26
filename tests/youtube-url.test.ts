import { describe, expect, it } from "vitest";
import { extractChannelReference, parseTimestampToSeconds, parseYouTubeInput } from "../src/utils/youtube-url.js";

describe("youtube-url utilities", () => {
  it("parses common video URL shapes", () => {
    expect(parseYouTubeInput("dQw4w9WgXcQ").videoId).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m20s")).toMatchObject({
      type: "video",
      videoId: "dQw4w9WgXcQ",
      timestampSec: 80
    });
    expect(parseYouTubeInput("https://youtu.be/dQw4w9WgXcQ").videoId).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeInput("https://youtube.com/shorts/dQw4w9WgXcQ").videoId).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeInput("https://youtube.com/embed/dQw4w9WgXcQ").videoId).toBe("dQw4w9WgXcQ");
  });

  it("parses channel, handle, playlist, and unknown inputs", () => {
    expect(parseYouTubeInput("@GoogleDevelopers")).toMatchObject({ type: "handle", handle: "@GoogleDevelopers" });
    expect(parseYouTubeInput("https://youtube.com/@GoogleDevelopers")).toMatchObject({ type: "handle", handle: "@GoogleDevelopers" });
    expect(parseYouTubeInput("https://youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw")).toMatchObject({
      type: "channel",
      channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw"
    });
    expect(parseYouTubeInput("https://youtube.com/playlist?list=PL123")).toMatchObject({ type: "playlist", playlistId: "PL123" });
    expect(parseYouTubeInput("https://example.com/watch?v=dQw4w9WgXcQ")).toMatchObject({ type: "unknown" });
  });

  it("normalizes timestamps and channel references", () => {
    expect(parseTimestampToSeconds("123s")).toBe(123);
    expect(parseTimestampToSeconds("1h2m3s")).toBe(3723);
    expect(extractChannelReference("https://youtube.com/c/Fireship")).toBe("Fireship");
  });
});
