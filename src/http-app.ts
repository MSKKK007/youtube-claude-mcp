import crypto from "node:crypto";
import express, { Express, NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Config, ToolDeps, CacheClient } from "./types.js";
import { authMiddleware } from "./auth/bearer-auth.js";
import { createYouTubeMcpServer } from "./server.js";
import { logger } from "./observability/logger.js";

interface HttpDeps extends ToolDeps {
  cache: CacheClient;
}

export function createHttpApp(config: Config, deps: HttpDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: true, credentials: false }));
  app.use(express.json({ limit: "1mb", type: ["application/json", "application/*+json"] }));
  app.use(requestLogger);

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: config.serviceName, version: config.version });
  });

  app.get("/ready", async (_req, res) => {
    const cacheOk = await deps.cache.ping();
    const ready = config.nodeEnv !== "production" || cacheOk;
    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "degraded",
      service: config.serviceName,
      cache: cacheOk ? "ok" : "unavailable",
      authMode: config.authMode
    });
  });

  app.all("/mcp", authMiddleware(config), async (req, res) => {
    if (!["GET", "POST", "DELETE"].includes(req.method)) {
      res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
      return;
    }
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined } as never);
    const server = createYouTubeMcpServer(config, deps);
    try {
      await server.connect(transport as never);
      await transport.handleRequest(req, res, req.body);
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
    } catch (error) {
      logger.error({ err: error, requestId: req.id }, "mcp request failed");
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
      }
      await transport.close().catch(() => undefined);
      await server.close().catch(() => undefined);
    }
  });

  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err: error, requestId: req.id }, "unhandled http error");
    res.status(500).json({ error: "internal_server_error" });
  });

  return app;
}

declare module "express-serve-static-core" {
  interface Request {
    id?: string;
  }
}

function requestLogger(req: Request, res: Response, next: NextFunction): void {
  req.id = req.header("x-request-id") ?? crypto.randomUUID();
  const startedAt = Date.now();
  res.on("finish", () => {
    logger.info(
      {
        requestId: req.id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt
      },
      "http request"
    );
  });
  next();
}
