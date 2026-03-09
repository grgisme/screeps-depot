import { Router, Response } from "express";
import { pushAuthenticate, PushAuthRequest } from "../middleware/pushAuth.js";
import prisma from "../lib/prisma.js";

const router = Router();

// All routes require push-token authentication
router.use(pushAuthenticate);

// ─── POST /api/push/stats ────────────────────────────────────────────────────
// Stats are now ingested via the poller (segment 97 → TickSnapshot).
// This endpoint is deprecated — push stats via segment 97 instead.
router.post("/stats", async (_req: PushAuthRequest, res: Response) => {
    res.status(410).json({
        error: "Stats push is deprecated. Stats are now ingested automatically from segment 97 into typed TickSnapshot tables.",
    });
});

// ─── POST /api/push/logs ─────────────────────────────────────────────────────
// Accepts a single log { message, severity? } or batch { logs: [...] }.
router.post("/logs", async (req: PushAuthRequest, res: Response) => {
    try {
        const { message, severity, logs } = req.body;

        // Batch mode: { logs: [{ message, severity? }, ...] }
        if (Array.isArray(logs)) {
            const validLogs = logs.filter(
                (l: { message?: string }) => l && typeof l.message === "string" && l.message.length > 0
            );

            if (validLogs.length === 0) {
                res.status(400).json({ error: "No valid log entries in 'logs' array" });
                return;
            }

            const created = await prisma.log.createMany({
                data: validLogs.map((l: { message: string; severity?: string }) => ({
                    message: l.message,
                    severity: parseSeverity(l.severity),
                    serverId: req.serverId!,
                })),
            });

            res.status(201).json({ count: created.count });
            return;
        }

        // Single mode: { message, severity? }
        if (!message || typeof message !== "string") {
            res.status(400).json({
                error: "Request body must include 'message' string, or 'logs' array for batch insert",
            });
            return;
        }

        const log = await prisma.log.create({
            data: {
                message,
                severity: parseSeverity(severity),
                serverId: req.serverId!,
            },
        });

        res.status(201).json({ id: log.id, timestamp: log.timestamp });
    } catch (err) {
        console.error("Push logs error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * Parse severity string into a valid enum value, defaulting to INFO.
 */
function parseSeverity(value?: string): "INFO" | "WARN" | "ERROR" {
    if (!value) return "INFO";
    const upper = value.toUpperCase();
    if (upper === "WARN" || upper === "ERROR") return upper;
    return "INFO";
}

export default router;
