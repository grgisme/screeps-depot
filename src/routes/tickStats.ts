import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";

const router = Router();
router.use(authenticate);

// ─── GET /api/tick-stats?serverId=...&hours=24 ────────────────────────────────
// Returns time-series data for charts, extracting specific metrics from TickStat JSON.
router.get("/", async (req: AuthRequest, res: Response) => {
    try {
        const serverId = req.query.serverId as string;
        const hours = parseInt((req.query.hours as string) || "24", 10);
        const metrics = (req.query.metrics as string)?.split(",") || [];

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

        const since = new Date(Date.now() - hours * 60 * 60 * 1000);
        const tickStats = await prisma.tickStat.findMany({
            where: {
                serverId,
                recordedAt: { gte: since },
            },
            orderBy: { tick: "asc" },
            take: 2000,
        });

        // Build chart-ready data: array of { tick, time, ...metricValues }
        const chartData = tickStats.map((ts) => {
            const data = ts.data as Record<string, unknown>;
            const point: Record<string, unknown> = {
                tick: ts.tick,
                time: ts.recordedAt.toISOString(),
            };

            if (metrics.length > 0) {
                for (const m of metrics) {
                    if (data[m] !== undefined) point[m] = data[m];
                }
            } else {
                // Return all numeric values
                for (const [key, val] of Object.entries(data)) {
                    if (typeof val === "number") point[key] = val;
                }
            }
            return point;
        });

        // Discover available metrics
        const allKeys = new Set<string>();
        for (const ts of tickStats) {
            const data = ts.data as Record<string, unknown>;
            for (const [key, val] of Object.entries(data)) {
                if (typeof val === "number") allKeys.add(key);
            }
        }

        res.json({
            chartData,
            availableMetrics: Array.from(allKeys).sort(),
            totalPoints: chartData.length,
            serverName: server.name,
            from: since.toISOString(),
            to: new Date().toISOString(),
        });
    } catch (err) {
        console.error("tick-stats error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ─── GET /api/tick-stats/latest?serverId=... ──────────────────────────────────
// Returns the most recent tick snapshot (for KPI cards).
router.get("/latest", async (req: AuthRequest, res: Response) => {
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

        const latest = await prisma.tickStat.findFirst({
            where: { serverId },
            orderBy: { tick: "desc" },
        });

        if (!latest) {
            res.json({ data: null });
            return;
        }

        res.json({
            tick: latest.tick,
            shard: latest.shard,
            recordedAt: latest.recordedAt.toISOString(),
            data: latest.data,
        });
    } catch (err) {
        console.error("tick-stats/latest error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ─── GET /api/tick-stats/rooms?serverId=... ───────────────────────────────────
// Returns per-room metrics from the latest tick snapshot.
router.get("/rooms", async (req: AuthRequest, res: Response) => {
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

        const latest = await prisma.tickStat.findFirst({
            where: { serverId },
            orderBy: { tick: "desc" },
        });

        if (!latest) {
            res.json({ rooms: {} });
            return;
        }

        // Extract rooms.* keys into nested structure
        const data = latest.data as Record<string, unknown>;
        const rooms: Record<string, Record<string, unknown>> = {};

        for (const [key, val] of Object.entries(data)) {
            if (key.startsWith("rooms.")) {
                const parts = key.split(".");
                if (parts.length >= 3) {
                    const roomName = parts[1]; // e.g. "E1N8"
                    const metric = parts.slice(2).join("."); // e.g. "energyAvailable"
                    if (!rooms[roomName]) rooms[roomName] = {};
                    rooms[roomName][metric] = val;
                }
            }
        }

        res.json({
            tick: latest.tick,
            recordedAt: latest.recordedAt.toISOString(),
            rooms,
        });
    } catch (err) {
        console.error("tick-stats/rooms error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ─── GET /api/tick-stats/processes?serverId=...&hours=1 ───────────────────────
// Returns CPU-by-process time-series.
router.get("/processes", async (req: AuthRequest, res: Response) => {
    try {
        const serverId = req.query.serverId as string;
        const hours = parseInt((req.query.hours as string) || "1", 10);

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

        const since = new Date(Date.now() - hours * 60 * 60 * 1000);
        const tickStats = await prisma.tickStat.findMany({
            where: { serverId, recordedAt: { gte: since } },
            orderBy: { tick: "asc" },
            take: 500,
        });

        // Extract processes.* keys
        const processNames = new Set<string>();
        const chartData = tickStats.map((ts) => {
            const data = ts.data as Record<string, unknown>;
            const point: Record<string, unknown> = {
                tick: ts.tick,
                time: ts.recordedAt.toISOString(),
            };
            for (const [key, val] of Object.entries(data)) {
                if (key.startsWith("processes.") && typeof val === "number") {
                    const name = key.replace("processes.", "");
                    processNames.add(name);
                    point[name] = val;
                }
            }
            return point;
        });

        res.json({
            chartData,
            processes: Array.from(processNames).sort(),
            totalPoints: chartData.length,
        });
    } catch (err) {
        console.error("tick-stats/processes error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ─── GET /api/tick-stats/energy?serverId=...&hours=24 ─────────────────────────
// Returns per-room and empire-wide energy time-series.
// Energy = energyAvailable + storageEnergy + terminalEnergy per room.
router.get("/energy", async (req: AuthRequest, res: Response) => {
    try {
        const serverId = req.query.serverId as string;
        const hours = parseInt((req.query.hours as string) || "24", 10);

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

        const since = new Date(Date.now() - hours * 60 * 60 * 1000);
        const tickStats = await prisma.tickStat.findMany({
            where: { serverId, recordedAt: { gte: since } },
            orderBy: { tick: "asc" },
            take: 2000,
        });

        // Energy keys we sum per room
        const ENERGY_KEYS = ["energyAvailable", "storageEnergy", "terminalEnergy"];

        const roomNames = new Set<string>();
        const chartData = tickStats.map((ts) => {
            const data = ts.data as Record<string, unknown>;
            const point: Record<string, unknown> = {
                tick: ts.tick,
                time: ts.recordedAt.toISOString(),
            };

            // Gather per-room energy totals
            let empireTotal = 0;
            const roomTotals: Record<string, number> = {};

            for (const [key, val] of Object.entries(data)) {
                if (!key.startsWith("rooms.") || typeof val !== "number") continue;
                const parts = key.split(".");
                if (parts.length < 3) continue;
                const roomName = parts[1];
                const metric = parts.slice(2).join(".");
                if (!ENERGY_KEYS.includes(metric)) continue;

                roomNames.add(roomName);
                roomTotals[roomName] = (roomTotals[roomName] || 0) + val;
            }

            for (const [room, total] of Object.entries(roomTotals)) {
                point[room] = total;
                empireTotal += total;
            }
            point["empire"] = empireTotal;

            return point;
        });

        res.json({
            chartData,
            rooms: Array.from(roomNames).sort(),
            totalPoints: chartData.length,
            from: since.toISOString(),
            to: new Date().toISOString(),
        });
    } catch (err) {
        console.error("tick-stats/energy error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
