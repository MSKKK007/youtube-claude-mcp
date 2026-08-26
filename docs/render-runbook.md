# Render Production Runbook

## Deploy

1. Push the repository to Git.
2. In Render, create a Redis instance.
3. In Render, create a Web Service using Docker.
4. Set all production environment variables from `.env.example`.
5. Deploy the service.
6. Confirm `GET /health` and `GET /ready` return `200`.
7. Confirm unauthenticated `/mcp` returns `401`.
8. Confirm an Auth0 bearer token with `youtube:read` can call MCP initialize/list tools.

## Rollback

1. Open the Render Web Service.
2. Select a previous successful deploy.
3. Trigger rollback.
4. Re-check `/health`, `/ready`, and Claude.ai connector tool listing.

## Secret Rotation

1. Create a new YouTube API key in Google Cloud.
2. Restrict it to the YouTube Data API v3.
3. Update `YOUTUBE_API_KEY` in Render.
4. Redeploy.
5. Revoke the old key after smoke tests pass.

## Incident Checks

- Auth failures: verify Auth0 issuer, audience, JWKS URL, and `youtube:read` scope.
- Quota failures: inspect YouTube API quota dashboard and reduce search-heavy usage.
- Transcript failures: distinguish no public captions from YouTube blocking.
- Redis failures: check Render Redis status; service should continue with cache misses.
- Latency: inspect upstream YouTube timings and request timeout settings.
