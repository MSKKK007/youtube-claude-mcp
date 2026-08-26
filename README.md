# YouTube MCP Connector for Claude.ai

Production remote MCP server that lets Claude.ai use read-only YouTube tools over HTTPS:

- `search_videos`
- `get_trending_videos`
- `get_channel_videos`
- `get_video_details`
- `get_engagement_stats`
- `get_transcript`
- `search_transcript`

The service uses the official YouTube Data API v3 for search, metadata, trending, and channel uploads. Transcript retrieval is best-effort: it tries public InnerTube caption tracks first, then YouTube watch-page caption discovery. It does not bypass CAPTCHA, blocks, or rate limits.

## Local Setup

```bash
npm install
cp .env.example .env
```

Set at minimum:

```bash
YOUTUBE_API_KEY=your_google_api_key
AUTH_MODE=none
```

Run locally:

```bash
npm run dev
```

Health checks:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

Build and test:

```bash
npm test
npm run build
```

## Production Environment

Required production variables:

```bash
NODE_ENV=production
YOUTUBE_API_KEY=...
AUTH_MODE=oauth
AUTH_ISSUER=https://YOUR_AUTH0_DOMAIN/
AUTH_AUDIENCE=https://youtube-claude-mcp
AUTH_JWKS_URL=https://YOUR_AUTH0_DOMAIN/.well-known/jwks.json
AUTH_REQUIRED_SCOPE=youtube:read
REDIS_URL=...
```

Default cache TTLs:

```bash
TRANSCRIPT_CACHE_TTL_SECONDS=604800
VIDEO_DETAILS_CACHE_TTL_SECONDS=900
TRENDING_CACHE_TTL_SECONDS=600
CHANNEL_VIDEOS_CACHE_TTL_SECONDS=600
```

## Auth0 Setup

1. Create or reuse an Auth0 API.
2. Set the API identifier to the same value as `AUTH_AUDIENCE`.
3. Add scope `youtube:read`.
4. Use the Auth0 issuer URL as `AUTH_ISSUER`.
5. Use the tenant JWKS endpoint as `AUTH_JWKS_URL`.
6. Configure Claude.ai custom connector OAuth advanced settings with the appropriate Auth0 client details.

The `/mcp` endpoint requires a valid `Authorization: Bearer <token>` when `AUTH_MODE=oauth`.

## Render Deployment

1. Create a Render Redis instance.
2. Create a Render Web Service from this repository.
3. Select Docker deployment.
4. Add the production environment variables.
5. Deploy.
6. Verify:

```bash
curl https://YOUR_RENDER_URL/health
curl https://YOUR_RENDER_URL/ready
curl -i https://YOUR_RENDER_URL/mcp
```

Unauthenticated `/mcp` should return `401`.

## Claude.ai Connector

1. Open Claude.ai settings.
2. Go to Customize, then Connectors.
3. Add a custom connector.
4. Use:

```text
https://YOUR_RENDER_URL/mcp
```

5. Configure OAuth advanced settings if production auth is enabled.
6. Enable the connector in a chat.

Demo prompts:

- Search YouTube for 5 recent MCP server tutorials.
- What are the most popular videos in Pakistan right now?
- Show the latest videos from @GoogleDevelopers.
- Get views, likes and duration for this YouTube URL.
- Calculate its engagement rate.
- Get the transcript and summarize it.
- Where in the transcript do they mention authentication?

## Operational Notes

- Restrict and rotate the YouTube API key in Google Cloud where practical.
- Do not log API keys, bearer tokens, or full authorization headers.
- Search calls are quota-expensive; prefer channel uploads and cached metadata where possible.
- Redis failures degrade cache behavior but do not fail normal tool calls.
- Transcript failures can happen when captions are disabled, unavailable, region-restricted, or blocked by YouTube.
- CAPTCHA or bot-block responses are surfaced as errors; the service does not attempt bypasses.

## Troubleshooting

- Startup fails with `YOUTUBE_API_KEY is required`: set the server-side API key.
- Startup fails in production with `REDIS_URL is required`: attach Render Redis and set its URL.
- `/mcp` returns `401`: token is missing, expired, malformed, or signed by the wrong issuer.
- `/mcp` returns `403`: token is valid but lacks `youtube:read`.
- Transcript tool returns unavailable: the video may not have public captions.
- YouTube quota exceeded: wait for quota reset, request a quota increase, or reduce search usage.
