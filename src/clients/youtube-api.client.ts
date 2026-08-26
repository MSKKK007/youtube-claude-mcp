import { CacheClient, Config, EngagementStats, VideoDetails, VideoSearchResult } from "../types.js";
import { cacheKey } from "../cache/redis-cache.js";
import { fetchJson } from "./http-client.js";
import { AppError } from "../utils/errors.js";
import { formatDuration } from "../utils/format.js";
import { publishedAfterForUploadDate } from "../utils/validation.js";

interface YouTubeListResponse<T> {
  items?: T[];
  error?: { code?: number; message?: string; errors?: Array<{ reason?: string }> };
}

interface SearchItem {
  id?: { videoId?: string };
  snippet?: Snippet;
}

interface VideoItem {
  id?: string;
  snippet?: Snippet & { tags?: string[]; categoryId?: string };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
}

interface ChannelItem {
  id?: string;
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
}

interface PlaylistItem {
  snippet?: Snippet & { resourceId?: { videoId?: string } };
}

interface Snippet {
  title?: string;
  description?: string;
  channelTitle?: string;
  channelId?: string;
  publishedAt?: string;
  thumbnails?: Record<string, { url?: string }>;
}

export class YouTubeApiClient {
  constructor(
    private readonly config: Config,
    private readonly cache: CacheClient
  ) {}

  async searchVideos(options: {
    query: string;
    maxResults: number;
    order?: string | undefined;
    duration?: string | undefined;
    uploadDate?: string | undefined;
    regionCode?: string | undefined;
    channelId?: string | undefined;
  }): Promise<VideoSearchResult[]> {
    const params: Record<string, string> = {
      part: "snippet",
      type: "video",
      q: options.query,
      maxResults: String(options.maxResults),
      order: options.order ?? "relevance"
    };
    if (options.duration) params.videoDuration = options.duration;
    if (options.regionCode) params.regionCode = options.regionCode;
    if (options.channelId) params.channelId = options.channelId;
    const publishedAfter = publishedAfterForUploadDate(options.uploadDate);
    if (publishedAfter) params.publishedAfter = publishedAfter;
    const response = await this.request<YouTubeListResponse<SearchItem>>("search", params);
    return (response.items ?? []).map(searchItemToResult).filter(Boolean) as VideoSearchResult[];
  }

  async getTrendingVideos(options: { regionCode: string; categoryId?: string; maxResults: number }): Promise<VideoDetails[]> {
    const key = cacheKey("trending", options.regionCode, options.categoryId, options.maxResults);
    const cached = await this.cache.getJson<VideoDetails[]>(key);
    if (cached) return cached;
    const response = await this.request<YouTubeListResponse<VideoItem>>("videos", {
      part: "snippet,contentDetails,statistics",
      chart: "mostPopular",
      regionCode: options.regionCode,
      maxResults: String(options.maxResults),
      ...(options.categoryId ? { videoCategoryId: options.categoryId } : {})
    });
    const videos = (response.items ?? []).map(videoItemToDetails).filter(Boolean) as VideoDetails[];
    await this.cache.setJson(key, videos, this.config.cacheTtls.trendingSeconds);
    return videos;
  }

  async getVideoDetails(videoId: string): Promise<VideoDetails> {
    const key = cacheKey("video", videoId);
    const cached = await this.cache.getJson<VideoDetails>(key);
    if (cached) return cached;
    const response = await this.request<YouTubeListResponse<VideoItem>>("videos", {
      part: "snippet,contentDetails,statistics",
      id: videoId
    });
    const details = videoItemToDetails(response.items?.[0]);
    if (!details) throw new AppError("Video was not found or is unavailable", "NOT_FOUND", 404);
    await this.cache.setJson(key, details, this.config.cacheTtls.videoDetailsSeconds);
    return details;
  }

  async getEngagementStats(videoId: string): Promise<EngagementStats> {
    const details = await this.getVideoDetails(videoId);
    const views = details.views;
    const likeRate = views > 0 && details.likes !== null ? details.likes / views : null;
    const commentRate = views > 0 && details.comments !== null ? details.comments / views : null;
    const engagementRate = views > 0 ? ((details.likes ?? 0) + (details.comments ?? 0)) / views : null;
    return {
      videoId,
      title: details.title,
      views,
      likes: details.likes,
      comments: details.comments,
      likeRate,
      commentRate,
      engagementRate
    };
  }

  async resolveChannelId(channel: string): Promise<string> {
    if (/^UC[a-zA-Z0-9_-]{22}$/.test(channel)) return channel;
    const handle = channel.startsWith("@") ? channel : undefined;
    if (handle) {
      const response = await this.request<YouTubeListResponse<ChannelItem>>("channels", {
        part: "id",
        forHandle: handle.slice(1)
      });
      const id = response.items?.[0]?.id;
      if (id) return id;
    }
    const search = await this.request<YouTubeListResponse<SearchItem>>("search", {
      part: "snippet",
      type: "channel",
      q: channel,
      maxResults: "1"
    });
    const id = search.items?.[0]?.snippet?.channelId;
    if (!id) throw new AppError("Channel was not found", "NOT_FOUND", 404);
    return id;
  }

  async getChannelVideos(channel: string, maxResults: number): Promise<{ channelId: string; videos: VideoSearchResult[] }> {
    const channelId = await this.resolveChannelId(channel);
    const key = cacheKey("channel-videos", channelId, maxResults);
    const cached = await this.cache.getJson<{ channelId: string; videos: VideoSearchResult[] }>(key);
    if (cached) return cached;
    const channelResponse = await this.request<YouTubeListResponse<ChannelItem>>("channels", {
      part: "contentDetails",
      id: channelId
    });
    const uploads = channelResponse.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) throw new AppError("Channel uploads playlist was not found", "NOT_FOUND", 404);
    const playlistResponse = await this.request<YouTubeListResponse<PlaylistItem>>("playlistItems", {
      part: "snippet",
      playlistId: uploads,
      maxResults: String(maxResults)
    });
    const videos = (playlistResponse.items ?? []).map(playlistItemToResult).filter(Boolean) as VideoSearchResult[];
    const result = { channelId, videos };
    await this.cache.setJson(key, result, this.config.cacheTtls.channelVideosSeconds);
    return result;
  }

  private async request<T extends { error?: unknown }>(endpoint: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
    for (const [key, value] of Object.entries({ ...params, key: this.config.youtubeApiKey })) {
      url.searchParams.set(key, value);
    }
    try {
      const response = await fetchJson<T>(url.toString(), {}, this.config.youtubeTimeoutMs);
      if (response.error) throw this.toApiError(response.error);
      return response;
    } catch (error) {
      if (error instanceof AppError && error.code === "HTTP_ERROR") throw this.toHttpApiError(error);
      throw error;
    }
  }

  private toApiError(error: unknown): AppError {
    const body = error as { code?: number; message?: string; errors?: Array<{ reason?: string }> };
    return this.toHttpApiError(new AppError(body.message ?? "YouTube API error", "HTTP_ERROR", body.code));
  }

  private toHttpApiError(error: AppError): AppError {
    const message = error.message;
    if (/quotaExceeded|dailyLimitExceeded/i.test(message)) return new AppError("YouTube API quota was exceeded", "YOUTUBE_QUOTA_EXCEEDED", 429);
    if (error.status === 401 || error.status === 403) return new AppError("YouTube API authentication or permission failed", "YOUTUBE_AUTH_FAILED", error.status);
    if (error.status === 404) return new AppError("YouTube resource was not found", "NOT_FOUND", 404);
    if (error.status === 429) return new AppError("YouTube API rate limit was reached", "RATE_LIMITED", 429);
    return new AppError("YouTube API request failed", "YOUTUBE_API_ERROR", error.status);
  }
}

function searchItemToResult(item: SearchItem): VideoSearchResult | undefined {
  const videoId = item.id?.videoId;
  if (!videoId || !item.snippet) return undefined;
  return snippetToResult(videoId, item.snippet);
}

function playlistItemToResult(item: PlaylistItem): VideoSearchResult | undefined {
  const videoId = item.snippet?.resourceId?.videoId;
  if (!videoId || !item.snippet) return undefined;
  return snippetToResult(videoId, item.snippet);
}

function snippetToResult(videoId: string, snippet: Snippet): VideoSearchResult {
    const result: VideoSearchResult = {
    videoId,
    title: snippet.title ?? "",
    channelTitle: snippet.channelTitle ?? "",
    channelId: snippet.channelId ?? "",
    publishedAt: snippet.publishedAt ?? "",
    description: snippet.description ?? "",
    url: `https://www.youtube.com/watch?v=${videoId}`
  };
  const thumbnailUrl = bestThumbnail(snippet);
  return thumbnailUrl ? { ...result, thumbnailUrl } : result;
}

function videoItemToDetails(item: VideoItem | undefined): VideoDetails | undefined {
  if (!item?.id || !item.snippet) return undefined;
  const result: VideoDetails = {
    ...snippetToResult(item.id, item.snippet),
    views: toCount(item.statistics?.viewCount) ?? 0,
    likes: toCount(item.statistics?.likeCount),
    comments: toCount(item.statistics?.commentCount),
    tags: item.snippet.tags ?? []
  };
  const duration = formatDuration(item.contentDetails?.duration);
  return {
    ...result,
    ...(duration ? { duration } : {}),
    ...(item.contentDetails?.duration ? { durationIso: item.contentDetails.duration } : {}),
    ...(item.snippet.categoryId ? { categoryId: item.snippet.categoryId } : {})
  };
}

function toCount(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bestThumbnail(snippet: Snippet): string | undefined {
  return snippet.thumbnails?.maxres?.url ?? snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url;
}
