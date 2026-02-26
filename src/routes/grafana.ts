import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

// ─── GET /api/grafana ────────────────────────────────────────────────────────
// Health check — Grafana Simple JSON datasource pings this to verify connectivity.
router.get("/", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
});

// ─── POST /api/grafana/search ────────────────────────────────────────────────
// Returns available metric targets for the Grafana query editor.
// Metrics are formatted as "ServerName / key" for each JSON key found in stat data.
router.post("/search", async (_req: Request, res: Response) => {
    try {
        const servers = await prisma.screepsServer.findMany({
            select: { id: true, name: true },
        });

        // For each server, grab one recent stat to discover available keys
        const targets: string[] = [];
        for (const server of servers) {
            const recentStat = await prisma.stat.findFirst({
                where: { serverId: server.id },
                orderBy: { recordedAt: "desc" },
            });

            if (recentStat && typeof recentStat.data === "object" && recentStat.data !== null) {
                const data = recentStat.data as Record<string, unknown>;
                for (const key of Object.keys(data)) {
                    targets.push(`${server.name} / ${key}`);
                }
            }

            // Always add a "logs" pseudo-target per server
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

            const serverName = targetStr.slice(0, slashIdx);
            const metricKey = targetStr.slice(slashIdx + 3);
            const serverId = serverMap.get(serverName);
            if (!serverId) continue;

            // Special case: "logs" returns table data
            if (metricKey === "logs") {
                const logs = await prisma.log.findMany({
                    where: {
                        serverId,
                        timestamp: { gte: from, lte: to },
                    },
                    orderBy: { timestamp: "asc" },
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

            // Timeseries: extract the metric key from each stat's JSON data
            if (targetType === "timeserie" || targetType === "timeseries") {
                const stats = await prisma.stat.findMany({
                    where: {
                        serverId,
                        recordedAt: { gte: from, lte: to },
                    },
                    orderBy: { recordedAt: "asc" },
                    take: limit,
                });

                const datapoints: [number, number][] = [];
                for (const stat of stats) {
                    const data = stat.data as Record<string, unknown>;
                    const value = data[metricKey];
                    if (typeof value === "number") {
                        datapoints.push([value, stat.recordedAt.getTime()]);
                    } else if (typeof value === "string") {
                        const num = parseFloat(value);
                        if (!isNaN(num)) {
                            datapoints.push([num, stat.recordedAt.getTime()]);
                        }
                    }
                }

                results.push({
                    target: targetStr,
                    datapoints,
                });
            } else if (targetType === "table") {
                // Table format for stat data
                const stats = await prisma.stat.findMany({
                    where: {
                        serverId,
                        recordedAt: { gte: from, lte: to },
                    },
                    orderBy: { recordedAt: "asc" },
                    take: limit,
                });

                // Collect all unique keys across all stats
                const allKeys = new Set<string>();
                for (const stat of stats) {
                    const data = stat.data as Record<string, unknown>;
                    for (const key of Object.keys(data)) allKeys.add(key);
                }

                const columns = [
                    { text: "Time", type: "time" as const },
                    ...Array.from(allKeys).map((k) => ({
                        text: k,
                        type: "number" as const,
                    })),
                ];

                const rows = stats.map((stat) => {
                    const data = stat.data as Record<string, unknown>;
                    return [
                        stat.recordedAt.getTime(),
                        ...Array.from(allKeys).map((k) => {
                            const v = data[k];
                            return typeof v === "number" ? v : v ?? null;
                        }),
                    ];
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

        // Filter to matching servers if query is provided
        const matchingServers = query
            ? servers.filter((s) =>
                s.name.toLowerCase().includes(query.toLowerCase())
            )
            : servers;

        const serverIds = matchingServers.map((s) => s.id);
        const serverNameMap = new Map(servers.map((s) => [s.id, s.name]));

        const logs = await prisma.log.findMany({
            where: {
                serverId: { in: serverIds },
                timestamp: { gte: from, lte: to },
                severity: { in: ["WARN", "ERROR"] }, // Only notable events
            },
            orderBy: { timestamp: "asc" },
            take: 100,
        });

        const annotations = logs.map((log) => ({
            annotation,
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
