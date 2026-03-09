import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import { pruneOldData, getTableCounts } from "../services/retention.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── GET /api/dashboard/stats?serverId=...&hours=24 ──────────────────────────
// Returns time-series data for the dashboard overview charts.
// Now queries typed TickSnapshot columns directly instead of parsing JSON.
//
// Response format:
// {
//   chartData: [{ time: "...", cpu: 1.8, gcl: 7624283, ... }, ...],
//   series: { cpu: [{time, value}, ...], gcl: [{time, value}, ...] },
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

        const server = await prisma.screepsServer.findFirst({
            where: { id: serverId, userId: req.userId! },
        });
        if (!server) {
            res.status(404).json({ error: "Server not found" });
            return;
        }

        const from = new Date(Date.now() - hours * 60 * 60 * 1000);
        const to = new Date();

        const snapshots = await prisma.tickSnapshot.findMany({
            where: {
                serverId,
                recordedAt: { gte: from, lte: to },
            },
            orderBy: { recordedAt: "asc" },
            take: 500,
        });

        // Dashboard historically showed these user-stats metrics from the old Stat table
        const metricKeys = ["cpu", "gcl", "credits"];

        // Map TickSnapshot columns to the old flat names
        const chartData = snapshots.map((s) => ({
            time: s.recordedAt.toISOString(),
            cpu: s.cpuLimit,
            gcl: s.gclProgress,
            credits: s.marketCredits,
        }));

        // Build series format (array of { time, value } per metric)
        const series: Record<string, { time: string; value: number }[]> = {};
        for (const key of metricKeys) {
            series[key] = chartData.map((point) => ({
                time: point.time,
                value: (point as Record<string, unknown>)[key] as number,
            }));
        }

        res.json({
            chartData,
            series,
            availableMetrics: metricKeys,
            serverName: server.name,
            from: from.toISOString(),
            to: to.toISOString(),
            totalPoints: snapshots.length,
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
            res.status(400).json({ error: "serverId is required" });
            return;
        }

        const where: Record<string, unknown> = { serverId };

        if (severity && severity.trim().length > 0) {
            const upper = severity.toUpperCase();
            if (["INFO", "WARN", "ERROR"].includes(upper)) {
                where.severity = upper;
            }
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

// ─── POST /api/dashboard/retention/run ────────────────────────────────────────
// Manually trigger a retention pass and auto-tune. Useful when the DB is close to capacity.
router.post("/retention/run", async (_req: AuthRequest, res: Response) => {
    try {
        const { tuneRetentionSettings } = await import("../services/retention.js");
        await tuneRetentionSettings();
        const result = await pruneOldData();
        res.json(result);
    } catch (err) {
        console.error("Retention run error:", err);
        res.status(500).json({ error: "Retention pass failed", detail: String(err) });
    }
});

// ─── GET /api/dashboard/retention/stats ───────────────────────────────────────
// Returns current row counts, configured retention hours, and actual DB sizes.
router.get("/retention/stats", async (_req: AuthRequest, res: Response) => {
    try {
        const { getRetentionSettings } = await import("../services/retention.js");

        const [counts, settings, latestDiagnostic] = await Promise.all([
            getTableCounts(),
            getRetentionSettings(),
            prisma.systemDiagnostic.findFirst({
                where: { type: "db_table_sizes" },
                orderBy: { recordedAt: "desc" }
            })
        ]);

        res.json({
            counts,
            retentionHours: settings.retentionHours,
            consoleRetentionHours: settings.consoleRetentionHours,
            diagnostic: latestDiagnostic || null
        });
    } catch (err) {
        console.error("Retention stats error:", err);
        res.status(500).json({ error: "Failed to get table counts" });
    }
});

export default router;
