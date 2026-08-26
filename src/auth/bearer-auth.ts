import { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify, JWTPayload } from "jose";
import { AuthInfo as McpAuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { Config, ValidatedAuthInfo } from "../types.js";
import { logger } from "../observability/logger.js";

declare module "express-serve-static-core" {
  interface Request {
    auth?: McpAuthInfo;
    validatedAuth?: ValidatedAuthInfo;
  }
}

export function extractBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new Error("Missing bearer token");
  }
  const token = authorizationHeader.slice("Bearer ".length).trim();
  if (!token) throw new Error("Missing bearer token");
  return token;
}

export async function validateAccessToken(token: string, config: Config): Promise<ValidatedAuthInfo> {
  if (!config.authIssuer || !config.authAudience || !config.authJwksUrl) {
    throw new Error("OAuth configuration is incomplete");
  }
  const jwks = createRemoteJWKSet(new URL(config.authJwksUrl));
  const verified = await jwtVerify(token, jwks, {
    issuer: config.authIssuer,
    audience: config.authAudience
  });
  const scopes = readScopes(verified.payload);
  if (config.authRequiredScope && !scopes.includes(config.authRequiredScope)) {
    const error = new Error("Token lacks required scope");
    error.name = "Forbidden";
    throw error;
  }
  return {
    subject: verified.payload.sub ?? "unknown",
    issuer: verified.payload.iss ?? config.authIssuer,
    audience: verified.payload.aud ?? config.authAudience,
    scopes
  };
}

function readScopes(payload: JWTPayload): string[] {
  const scope = typeof payload.scope === "string" ? payload.scope : "";
  const permissions = Array.isArray(payload.permissions) ? payload.permissions.filter((value): value is string => typeof value === "string") : [];
  return Array.from(new Set([...scope.split(/\s+/).filter(Boolean), ...permissions]));
}

export function authMiddleware(config: Config) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (config.authMode === "none") {
      next();
      return;
    }
    try {
      const token = extractBearerToken(req.header("authorization"));
      const validated = await validateAccessToken(token, config);
      req.validatedAuth = validated;
      req.auth = {
        token,
        clientId: validated.subject,
        scopes: validated.scopes,
        extra: {
          issuer: validated.issuer,
          audience: validated.audience
        }
      };
      next();
    } catch (error) {
      const status = error instanceof Error && error.name === "Forbidden" ? 403 : 401;
      logger.warn({ err: error, status }, "auth rejected request");
      res.status(status).json({ error: status === 403 ? "forbidden" : "unauthorized" });
    }
  };
}
