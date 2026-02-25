import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";

/**
 * Extend Express Request with the server ID resolved from the push token.
 */
export interface PushAuthRequest extends Request {
    serverId?: string;
}

/**
 * Push-token authentication middleware.
 *
 * Validates incoming requests using the `X-Push-Token` header or `?token=` query param.
 * Looks up the ScreepsServer by its unique pushToken and attaches serverId to the request.
 */
export function pushAuthenticate(
    req: PushAuthRequest,
    res: Response,
    next: NextFunction
): void {
    const token =
        (req.headers["x-push-token"] as string) ||
        (req.query.token as string);

    if (!token) {
        res.status(401).json({ error: "Missing push token. Provide X-Push-Token header or ?token= query param." });
        return;
    }

    prisma.screepsServer
        .findUnique({ where: { pushToken: token } })
        .then((server) => {
            if (!server) {
                res.status(401).json({ error: "Invalid push token" });
                return;
            }
            req.serverId = server.id;
            next();
        })
        .catch((err) => {
            console.error("Push auth error:", err);
            res.status(500).json({ error: "Internal server error" });
        });
}
