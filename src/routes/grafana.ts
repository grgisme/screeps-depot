import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

// ─── GET /api/grafana ────────────────────────────────────────────────────────
// Health check for Grafana SimpleJSON datasource.
router.get("/", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
});

// ─── POST /api/grafana/search ────────────────────────────────────────────────
// Returns available metric targets for the Grafana query editor.
// Metrics are typed columns from TickSnapshot, prefixed with server name.
router.post("/search", async (_req: Request, res: Response) => {
    try {
        const servers = await prisma.screepsServer.findMany({
            select: { id: true, name: true },
        });

        const metricKeys = [
            "cpuUsed", "cpuLimit", "cpuBucket", "cpuTickLimit",
            "gclLevel", "gclProgress", "gclProgressTotal",
            "gplLevel", "gplProgress", "gplProgressTotal",
            "heapRatio", "marketCredits",
            "creepsMy", "creepsHostile",
            "spawnsTotal", "spawnsActive", "spawnsUtilization",
            "defenseTowerCount", "defenseTowerEnergy",
            "errorMapperTotalErrors", "errorMapperCpuUsed",
        ];

        const targets: string[] = [];
        for (const server of servers) {
            for (const key of metricKeys) {
                targets.push(`${server.name} / ${key}`);
            }
            // Also offer log target
            targets.push(`${server.name} / logs`);
        }

        res.json(targets);
    } catch (err) {
        console.error("Grafana search error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ─── POST /api/grafana/query ─────────────────────────────────────────────────
// Returns timeseries or table data based on the requested targets and time range.
router.post("/query", async (req: Request, res: Response) => {
    try {
        const { range, targets, maxDataPoints } = req.body;
        const from = new Date(range.from);
        const to = new Date(range.to);
        const limit = maxDataPoints || 500;

        // Build a lookup of server name → id
        const servers = await prisma.screepsServer.findMany({
            select: { id: true, name: true },
        });
        const serverMap = new Map(servers.map((s) => [s.name, s.id]));

        const results: unknown[] = [];

        for (const target of targets) {
            const targetStr: string = target.target;
            const targetType: string = target.type || "timeserie";

            // Parse "ServerName / key" format
            const slashIdx = targetStr.indexOf(" / ");
            if (slashIdx === -1) continue;

            const serverName = targetStr.substring(0, slashIdx);
            const metricKey = targetStr.substring(slashIdx + 3);
            const serverId = serverMap.get(serverName);
            if (!serverId) continue;

            // Special case: logs as table
            if (metricKey === "logs") {
                const logs = await prisma.log.findMany({
                    where: {
                        serverId,
                        timestamp: { gte: from, lte: to },
                    },
                    orderBy: { timestamp: "desc" },
                    take: limit,
                });

                results.push({
                    type: "table",
                    columns: [
                        { text: "Time", type: "time" },
                        { text: "Severity", type: "string" },
                        { text: "Message", type: "string" },
                    ],
                    rows: logs.map((l) => [
                        l.timestamp.getTime(),
                        l.severity,
                        l.message,
                    ]),
                });
                continue;
            }

            // Timeseries: query typed column directly
            if (targetType === "timeserie" || targetType === "timeseries") {
                const snapshots = await prisma.tickSnapshot.findMany({
                    where: {
                        serverId,
                        recordedAt: { gte: from, lte: to },
                    },
                    orderBy: { recordedAt: "asc" },
                    take: limit,
                });

                const datapoints: [number, number][] = [];
                for (const snap of snapshots) {
                    const val = (snap as Record<string, unknown>)[metricKey];
                    if (val !== undefined) {
                        const numVal = typeof val === "bigint" ? Number(val) : Number(val);
                        if (!isNaN(numVal)) {
                            datapoints.push([numVal, snap.recordedAt.getTime()]);
                        }
                    }
                }

                results.push({
                    target: targetStr,
                    datapoints,
                });
            } else if (targetType === "table") {
                // Table format for TickSnapshot data
                const snapshots = await prisma.tickSnapshot.findMany({
                    where: {
                        serverId,
                        recordedAt: { gte: from, lte: to },
                    },
                    orderBy: { recordedAt: "asc" },
                    take: limit,
                });

                const columns = [
                    { text: "Time", type: "time" },
                    { text: metricKey, type: "number" },
                ];

                const rows = snapshots.map((snap) => {
                    const val = (snap as Record<string, unknown>)[metricKey];
                    const numVal = typeof val === "bigint" ? Number(val) : Number(val);
                    return [snap.recordedAt.getTime(), isNaN(numVal) ? null : numVal];
                });

                results.push({ type: "table", columns, rows });
            }
        }

        res.json(results);
    } catch (err) {
        console.error("Grafana query error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ─── POST /api/grafana/annotations ───────────────────────────────────────────
// Returns log entries as Grafana annotations for the requested time range.
router.post("/annotations", async (req: Request, res: Response) => {
    try {
        const { range, annotation } = req.body;
        const from = new Date(range.from);
        const to = new Date(range.to);
        const query: string = annotation?.query || "";

        // If query contains a server name filter, use it
        const servers = await prisma.screepsServer.findMany({
            select: { id: true, name: true },
        });
        const serverNameMap = new Map(servers.map((s) => [s.id, s.name]));

        const where: Record<string, unknown> = {
            timestamp: { gte: from, lte: to },
        };

        if (query) {
            const matchedServer = servers.find((s) =>
                query.toLowerCase().includes(s.name.toLowerCase())
            );
            if (matchedServer) {
                where.serverId = matchedServer.id;
            }
        }

        const logs = await prisma.log.findMany({
            where,
            orderBy: { timestamp: "desc" },
            take: 100,
        });

        const annotations = logs.map((log) => ({
            time: log.timestamp.getTime(),
            title: `[${log.severity}] ${serverNameMap.get(log.serverId) || "Unknown"}`,
            tags: [log.severity, serverNameMap.get(log.serverId) || ""],
            text: log.message,
        }));

        res.json(annotations);
    } catch (err) {
        console.error("Grafana annotations error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ─── POST /api/grafana/tag-keys ──────────────────────────────────────────────
// Returns available tag keys for ad-hoc filtering.
router.post("/tag-keys", async (_req: Request, res: Response) => {
    try {
        res.json([
            { type: "string", text: "server" },
            { type: "string", text: "severity" },
        ]);
    } catch (err) {
        console.error("Grafana tag-keys error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ─── POST /api/grafana/tag-values ────────────────────────────────────────────
// Returns available values for a given tag key.
router.post("/tag-values", async (req: Request, res: Response) => {
    try {
        const { key } = req.body;

        if (key === "server") {
            const servers = await prisma.screepsServer.findMany({
                select: { name: true },
            });
            res.json(servers.map((s) => ({ text: s.name })));
        } else if (key === "severity") {
            res.json([
                { text: "INFO" },
                { text: "WARN" },
                { text: "ERROR" },
            ]);
        } else {
            res.json([]);
        }
    } catch (err) {
        console.error("Grafana tag-values error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
