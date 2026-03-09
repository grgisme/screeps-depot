import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";

const router = Router();
router.use(authenticate);

// ─── GET /api/tick-stats?serverId=...&hours=24&metrics=cpuUsed,cpuBucket ──────
// Returns time-series data for charts using typed columns.
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
        const snapshots = await prisma.tickSnapshot.findMany({
            where: {
                serverId,
                recordedAt: { gte: since },
            },
            orderBy: { tick: "asc" },
            take: 2000,
        });

        // Map between dot-notation (frontend) and camelCase (DB columns)
        const dotToCamel: Record<string, string> = {
            "cpu.used": "cpuUsed", "cpu.limit": "cpuLimit", "cpu.bucket": "cpuBucket", "cpu.tickLimit": "cpuTickLimit",
            "gcl.level": "gclLevel", "gcl.progress": "gclProgress", "gcl.progressTotal": "gclProgressTotal",
            "gpl.level": "gplLevel", "gpl.progress": "gplProgress", "gpl.progressTotal": "gplProgressTotal",
            "heap.used": "heapUsed", "heap.limit": "heapLimit", "heap.ratio": "heapRatio",
            "market.credits": "marketCredits", "market.activeOrders": "marketActiveOrders",
            "creeps.my": "creepsMy", "creeps.hostile": "creepsHostile",
            "spawns.total": "spawnsTotal", "spawns.active": "spawnsActive", "spawns.utilization": "spawnsUtilization",
            "defense.towerCount": "defenseTowerCount", "defense.towerEnergy": "defenseTowerEnergy",
            "defense.rampartCount": "defenseRampartCount", "defense.rampartMinHits": "defenseRampartMinHits",
            "errorMapper.totalErrors": "errorMapperTotalErrors", "errorMapper.cpuUsed": "errorMapperCpuUsed",
            "cache.size": "cacheSize", "cache.dirtyCount": "cacheDirtyCount", "cache.commitCPU": "cacheCommitCPU",
        };
        const camelToDot = Object.fromEntries(Object.entries(dotToCamel).map(([d, c]) => [c, d]));

        // All valid camelCase column names
        const allMetricNames = Object.values(dotToCamel);

        // Accept either dot-notation or camelCase from the frontend
        const resolvedMetrics = metrics.length > 0
            ? metrics.map((m) => dotToCamel[m] || m).filter((m) => allMetricNames.includes(m))
            : allMetricNames;

        const chartData = snapshots.map((s) => {
            const point: Record<string, unknown> = {
                tick: s.tick,
                time: s.recordedAt.toISOString(),
            };
            for (const m of resolvedMetrics) {
                const val = (s as Record<string, unknown>)[m];
                // Return dot-notation key (matching frontend dataKey props)
                const dotKey = camelToDot[m] || m;
                point[dotKey] = typeof val === "bigint" ? Number(val) : val;
            }
            return point;
        });

        res.json({
            chartData,
            availableMetrics: allMetricNames,
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

        const latest = await prisma.tickSnapshot.findFirst({
            where: { serverId },
            orderBy: { tick: "desc" },
            include: {
                roomSnapshots: true,
                processSnapshots: true,
                creepRoles: true,
            },
        });

        if (!latest) {
            res.json({ data: null });
            return;
        }

        // Build a backward-compatible flat data object for the frontend
        const data: Record<string, unknown> = {
            tick: latest.tick,
            shard: latest.shard,
            "cpu.used": latest.cpuUsed,
            "cpu.limit": latest.cpuLimit,
            "cpu.bucket": latest.cpuBucket,
            "cpu.tickLimit": latest.cpuTickLimit,
            "gcl.level": latest.gclLevel,
            "gcl.progress": latest.gclProgress,
            "gcl.progressTotal": latest.gclProgressTotal,
            "gpl.level": latest.gplLevel,
            "gpl.progress": latest.gplProgress,
            "gpl.progressTotal": latest.gplProgressTotal,
            "heap.used": Number(latest.heapUsed),
            "heap.limit": Number(latest.heapLimit),
            "heap.ratio": latest.heapRatio,
            "market.credits": latest.marketCredits,
            "market.activeOrders": latest.marketActiveOrders,
            "creeps.my": latest.creepsMy,
            "creeps.hostile": latest.creepsHostile,
            "spawns.total": latest.spawnsTotal,
            "spawns.active": latest.spawnsActive,
            "spawns.utilization": latest.spawnsUtilization,
            "defense.towerCount": latest.defenseTowerCount,
            "defense.towerEnergy": latest.defenseTowerEnergy,
            "defense.rampartCount": latest.defenseRampartCount,
            "defense.rampartMinHits": Number(latest.defenseRampartMinHits),
            "errorMapper.totalErrors": latest.errorMapperTotalErrors,
            "errorMapper.mappedCount": latest.errorMapperMappedCount,
            "errorMapper.rawCount": latest.errorMapperRawCount,
            "errorMapper.cpuUsed": latest.errorMapperCpuUsed,
            "errorMapper.uniqueFingerprints": latest.errorMapperUniqueFingerprints,
            "errorMapper.deferredQueue": latest.errorMapperDeferredQueue,
            "errorMapper.inResetLoop": latest.errorMapperInResetLoop,
            "cache.size": latest.cacheSize,
            "cache.dirtyCount": latest.cacheDirtyCount,
            "cache.pathCacheSize": latest.cachePathCacheSize,
            "cache.heapRatio": latest.cacheHeapRatio,
            "cache.evictedThisTick": latest.cacheEvictedThisTick,
            "cache.commitCPU": latest.cacheCommitCPU,
            "cache.schemaVersion": latest.cacheSchemaVersion,
            "cache.bucketThrottled": latest.cacheBucketThrottled,
        };

        // Add room data
        for (const room of latest.roomSnapshots) {
            data[`rooms.${room.roomName}.energyAvailable`] = room.energyAvailable;
            data[`rooms.${room.roomName}.energyCapacity`] = room.energyCapacity;
            data[`rooms.${room.roomName}.controllerLevel`] = room.controllerLevel;
            data[`rooms.${room.roomName}.controllerProgress`] = Number(room.controllerProgress);
            data[`rooms.${room.roomName}.controllerProgressTotal`] = Number(room.controllerProgressTotal);
            data[`rooms.${room.roomName}.storageEnergy`] = room.storageEnergy;
            data[`rooms.${room.roomName}.terminalEnergy`] = room.terminalEnergy;
            data[`rooms.${room.roomName}.creepCount`] = room.creepCount;
            data[`rooms.${room.roomName}.hostileCount`] = room.hostileCount;
        }

        // Add process data
        for (const proc of latest.processSnapshots) {
            data[`processes.${proc.processName}`] = proc.cpuUsed;
        }

        // Add creep role data
        for (const role of latest.creepRoles) {
            data[`creeps.roles.${role.roleName}`] = role.count;
        }

        res.json({
            tick: latest.tick,
            shard: latest.shard,
            recordedAt: latest.recordedAt.toISOString(),
            data,
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

        const latest = await prisma.tickSnapshot.findFirst({
            where: { serverId },
            orderBy: { tick: "desc" },
            include: { roomSnapshots: true },
        });

        if (!latest) {
            res.json({ rooms: {} });
            return;
        }

        // Build rooms object from typed child table
        const rooms: Record<string, Record<string, unknown>> = {};
        for (const room of latest.roomSnapshots) {
            rooms[room.roomName] = {
                energyAvailable: room.energyAvailable,
                energyCapacity: room.energyCapacity,
                controllerLevel: room.controllerLevel,
                controllerProgress: Number(room.controllerProgress),
                controllerProgressTotal: Number(room.controllerProgressTotal),
                storageEnergy: room.storageEnergy,
                terminalEnergy: room.terminalEnergy,
                creepCount: room.creepCount,
                hostileCount: room.hostileCount,
            };
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
        const snapshots = await prisma.tickSnapshot.findMany({
            where: { serverId, recordedAt: { gte: since } },
            orderBy: { tick: "asc" },
            take: 500,
            include: { processSnapshots: true },
        });

        const processNames = new Set<string>();
        const chartData = snapshots.map((s) => {
            const point: Record<string, unknown> = {
                tick: s.tick,
                time: s.recordedAt.toISOString(),
            };
            for (const proc of s.processSnapshots) {
                processNames.add(proc.processName);
                point[proc.processName] = proc.cpuUsed;
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
        const snapshots = await prisma.tickSnapshot.findMany({
            where: { serverId, recordedAt: { gte: since } },
            orderBy: { tick: "asc" },
            take: 2000,
            include: { roomSnapshots: true },
        });

        const roomNames = new Set<string>();
        const chartData = snapshots.map((s) => {
            const point: Record<string, unknown> = {
                tick: s.tick,
                time: s.recordedAt.toISOString(),
            };

            let empireTotal = 0;
            for (const room of s.roomSnapshots) {
                roomNames.add(room.roomName);
                const total = room.energyAvailable + room.storageEnergy + room.terminalEnergy;
                point[room.roomName] = total;
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
