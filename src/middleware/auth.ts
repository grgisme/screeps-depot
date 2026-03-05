import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

// Extend Express Request to include userId from JWT
export interface AuthRequest extends Request {
    userId?: string;
}

interface JwtPayload {
    userId: string;
}

/**
 * JWT authentication middleware.
 * Extracts the Bearer token from the Authorization header,
 * verifies it, and attaches `userId` to the request object.
 *
 * Also supports API-key auth via `X-API-Key` header, which looks up
 * a ScreepsServer by its pushToken and resolves the owning userId.
 * This allows MCP servers and other API clients to authenticate
 * using the same per-server push token.
 */
export function authenticate(
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void {
    const authHeader = req.headers.authorization;

    // ── Path 1: Bearer JWT (dashboard sessions) ──
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        try {
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                throw new Error("JWT_SECRET is not configured");
            }
            const decoded = jwt.verify(token, secret) as JwtPayload;
            req.userId = decoded.userId;
            next();
            return;
        } catch {
            res.status(401).json({ error: "Invalid or expired token" });
            return;
        }
    }

    // ── Path 2: X-API-Key (MCP / API clients using pushToken) ──
    const apiKey = req.headers["x-api-key"] as string | undefined;
    if (apiKey) {
        prisma.screepsServer
            .findUnique({ where: { pushToken: apiKey }, select: { userId: true } })
            .then((server) => {
                if (!server) {
                    res.status(401).json({ error: "Invalid API key" });
                    return;
                }
                req.userId = server.userId;
                next();
            })
            .catch((err) => {
                console.error("API key auth error:", err);
                res.status(500).json({ error: "Internal server error" });
            });
        return;
    }

    // ── No auth provided ──
    res.status(401).json({ error: "Missing authorization. Provide Bearer token or X-API-Key header." });
}
