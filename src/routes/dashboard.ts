import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";

const router = Router();

// All dashboard routes require JWT authentication
router.use(authenticate);

// ─── GET /api/dashboard/stats?serverId=...&hours=24 ──────────────────────────
// Returns historical stat data formatted for React charting libraries.
//
// Response format:
// {
//   series: {
//     cpu:     [{ time: "2026-02-25T18:00:00Z", value: 20 }, ...],
//     gcl:     [{ time: "...", value: 5000000 }, ...],
//     credits: [{ time: "...", value: 100 }, ...],
//   },
//   availableMetrics: ["cpu", "gcl", "credits", ...],
//   serverName: "TestWorld",
//   from: "...",
//   to: "..."
// }
router.get("/stats", async (req: AuthRequest, res: Response) => {
    try {
        const serverId = req.query.serverId as string;
        const hours = parseInt((req.query.hours as string) || "24", 10);

        if (!serverId) {
            res.status(400).json({ error: "serverId query parameter is required" });
            return;
        }

        // Verify ownership
        const server = await prisma.screepsServer.findFirst({
            where: { id: serverId, userId: req.userId! },
        });
        if (!server) {
            res.status(404).json({ error: "Server not found" });
            return;
        }

        const from = new Date(Date.now() - hours * 60 * 60 * 1000);
        const to = new Date();

        const stats = await prisma.stat.findMany({
            where: {
                serverId,
                recordedAt: { gte: from, lte: to },
            },
            orderBy: { recordedAt: "asc" },
            take: 1000,
        });

        // Discover all numeric keys across all stat entries
        const allKeys = new Set<string>();
        for (const stat of stats) {
            const data = stat.data as Record<string, unknown>;
            for (const [key, value] of Object.entries(data)) {
                if (typeof value === "number") {
                    allKeys.add(key);
                }
            }
        }

        // Exclude metadata keys that aren't useful for charting
        const excludeKeys = new Set(["type"]);
        const metricKeys = Array.from(allKeys).filter((k) => !excludeKeys.has(k));

        // Build a time-aligned flat array for Recharts
        // Each element: { time: "ISO string", cpu: 20, gcl: 5000000, ... }
        const chartData = stats.map((stat) => {
            const data = stat.data as Record<string, unknown>;
            const point: Record<string, unknown> = {
                time: stat.recordedAt.toISOString(),
            };
            for (const key of metricKeys) {
                const val = data[key];
                if (typeof val === "number") {
                    point[key] = val;
                }
            }
            return point;
        });

        // Also build per-metric series for flexibility
        const series: Record<string, { time: string; value: number }[]> = {};
        for (const key of metricKeys) {
            series[key] = [];
        }
        for (const stat of stats) {
            const data = stat.data as Record<string, unknown>;
            const time = stat.recordedAt.toISOString();
            for (const key of metricKeys) {
                const val = data[key];
                if (typeof val === "number") {
                    series[key].push({ time, value: val });
                }
            }
        }

        res.json({
            chartData,
            series,
            availableMetrics: metricKeys,
            serverName: server.name,
            from: from.toISOString(),
            to: to.toISOString(),
            totalPoints: stats.length,
        });
    } catch (err) {
        console.error("Dashboard stats error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
// ─── GET /api/dashboard/logs?serverId=...&limit=50&offset=0&severity=...&search=... ─
// Returns paginated log data with optional severity and keyword filters.
//
// Response format:
// {
//   logs: [{ id, message, severity, timestamp }, ...],
//   total: 150,
//   limit: 50,
//   offset: 0
// }
router.get("/logs", async (req: AuthRequest, res: Response) => {
    try {
        const serverId = req.query.serverId as string;
        const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 200);
        const offset = parseInt((req.query.offset as string) || "0", 10);
        const severity = req.query.severity as string | undefined;
        const search = req.query.search as string | undefined;

        if (!serverId) {
            res.status(400).json({ error: "serverId query parameter is required" });
            return;
        }

        // Verify ownership
        const server = await prisma.screepsServer.findFirst({
            where: { id: serverId, userId: req.userId! },
        });
        if (!server) {
            res.status(404).json({ error: "Server not found" });
            return;
        }

        // Build where clause
        const where: {
            serverId: string;
            severity?: "INFO" | "WARN" | "ERROR";
            message?: { contains: string; mode: "insensitive" };
        } = { serverId };

        if (severity && ["INFO", "WARN", "ERROR"].includes(severity.toUpperCase())) {
            where.severity = severity.toUpperCase() as "INFO" | "WARN" | "ERROR";
        }

        if (search && search.trim().length > 0) {
            where.message = { contains: search.trim(), mode: "insensitive" };
        }

        // Fetch total count and page of logs in parallel
        const [total, logs] = await Promise.all([
            prisma.log.count({ where }),
            prisma.log.findMany({
                where,
                orderBy: { timestamp: "desc" },
                take: limit,
                skip: offset,
            }),
        ]);

        res.json({ logs, total, limit, offset });
    } catch (err) {
        console.error("Dashboard logs error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
