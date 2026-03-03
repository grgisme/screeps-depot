import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";

const router = Router();
router.use(authenticate);

// ─── GET /api/flight-recorder?serverId=...&severity=E&page=1&limit=50 ────────
// Paginated, filterable event log from FlightRecorder segments.
router.get("/", async (req: AuthRequest, res: Response) => {
    try {
        const serverId = req.query.serverId as string;
        const severity = req.query.severity as string | undefined;
        const context = req.query.context as string | undefined;
        const room = req.query.room as string | undefined;
        const page = parseInt((req.query.page as string) || "1", 10);
        const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 200);

        if (!serverId) {
            res.status(400).json({ error: "serverId is required" });
            return;
        }

        const server = await prisma.screepsServer.findFirst({
            where: { id: serverId, userId: req.userId! },
        });
        if (!server) {
            res.status(404).json({ error: "Server not found" });
            return;
        }

        const where: Record<string, unknown> = { serverId };
        if (severity) where.severity = severity;
        if (context) where.context = { contains: context };
        if (room) where.room = room;

        const [entries, total] = await Promise.all([
            prisma.flightRecorderEntry.findMany({
                where,
                orderBy: { tick: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.flightRecorderEntry.count({ where }),
        ]);

        res.json({
            entries: entries.map((e) => ({
                id: e.id,
                tick: e.tick,
                severity: e.severity,
                context: e.context,
                message: e.message,
                stackTrace: e.stackTrace,
                room: e.room,
                correlationId: e.correlationId,
                segment: e.segment,
                recordedAt: e.recordedAt.toISOString(),
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (err) {
        console.error("flight-recorder error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ─── GET /api/flight-recorder/summary?serverId=... ───────────────────────────
// Counts by severity (last hour and last 24 hours).
router.get("/summary", async (req: AuthRequest, res: Response) => {
    try {
        const serverId = req.query.serverId as string;
        if (!serverId) {
            res.status(400).json({ error: "serverId is required" });
            return;
        }

        const server = await prisma.screepsServer.findFirst({
            where: { id: serverId, userId: req.userId! },
        });
        if (!server) {
            res.status(404).json({ error: "Server not found" });
            return;
        }

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const [hourCounts, dayCounts] = await Promise.all([
            prisma.flightRecorderEntry.groupBy({
                by: ["severity"],
                where: { serverId, recordedAt: { gte: oneHourAgo } },
                _count: true,
            }),
            prisma.flightRecorderEntry.groupBy({
                by: ["severity"],
                where: { serverId, recordedAt: { gte: oneDayAgo } },
                _count: true,
            }),
        ]);

        const toMap = (arr: { severity: string; _count: number }[]) => {
            const map: Record<string, number> = { I: 0, W: 0, E: 0 };
            for (const item of arr) map[item.severity] = item._count;
            return map;
        };

        res.json({
            lastHour: toMap(hourCounts),
            lastDay: toMap(dayCounts),
        });
    } catch (err) {
        console.error("flight-recorder/summary error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
