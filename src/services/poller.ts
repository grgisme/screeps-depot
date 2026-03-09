import cron from "node-cron";
import crypto from "crypto";
import prisma from "../lib/prisma.js";
import {
    fetchUserStats,
    fetchMemorySegment,
    fetchMemoryStats,
} from "./screepsApi.js";

const DEFAULT_CRON = "*/1 * * * *"; // Every 1 minute

/**
 * Start the background polling service.
 *
 * On each tick, queries all ScreepsServer entries where polling is enabled
 * and an API token is configured. For each server, fetches stats from the
 * Screeps Web API and saves the results to the database.
 */
export function startPoller(): void {
    const cronExpression = process.env.POLL_INTERVAL_CRON || DEFAULT_CRON;

    console.log(`📡 Poller scheduled with cron: "${cronExpression}"`);

    cron.schedule(cronExpression, async () => {
        console.log(`📡 [${new Date().toISOString()}] Polling started...`);

        try {
            const servers = await prisma.screepsServer.findMany({
                where: {
                    pollingEnabled: true,
                    apiToken: { not: null },
                },
            });

            if (servers.length === 0) {
                console.log("📡 No servers with polling enabled. Skipping.");
                return;
            }

            console.log(`📡 Polling ${servers.length} server(s)...`);

            // Process each server independently — one failure doesn't block others
            const results = await Promise.allSettled(
                servers.map((server) => pollServer(server))
            );

            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const server = servers[i];
                if (result.status === "rejected") {
                    console.error(`📡 ❌ Failed to poll "${server.name}":`, result.reason);

                    // Log the failure to the database
                    await prisma.log.create({
                        data: {
                            message: `Polling failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
                            severity: "ERROR",
                            serverId: server.id,
                        },
                    }).catch(() => { }); // Don't let logging failures cascade
                } else {
                    console.log(`📡 ✅ Polled "${server.name}" successfully`);
                }
            }

            console.log(`📡 [${new Date().toISOString()}] Polling complete.`);
        } catch (err) {
            console.error("📡 Poller top-level error:", err);
        }
    });
}

/**
 * Poll a single Screeps server: fetch all available data.
 * Exported so it can be triggered on-demand from the API.
 */
export async function pollServer(server: {
    id: string;
    name: string;
    apiToken: string | null;
    apiBaseUrl: string;
    shard?: string;
}): Promise<void> {
    if (!server.apiToken) return;

    const opts = {
        baseUrl: server.apiBaseUrl,
        token: server.apiToken,
    };
    const shard = server.shard || "shard3";

    // Run all ingestion tasks in parallel
    const taskNames = ["userStats", "segment97", "segment96", "segment98", "segment99"];
    const results = await Promise.allSettled([
        pollUserStats(opts, server.id),
        pollStatsSegment(opts, server.id, shard),
        pollFlightRecorder(opts, server.id, shard, 96),
        pollFlightRecorder(opts, server.id, shard, 98),
        pollFlightRecorder(opts, server.id, shard, 99),
    ]);

    // Build per-task summary
    const succeeded: string[] = [];
    const failed: string[] = [];
    for (let i = 0; i < results.length; i++) {
        if (results[i].status === "rejected") {
            const reason = (results[i] as PromiseRejectedResult).reason;
            const msg = reason instanceof Error ? reason.message : String(reason);
            failed.push(`${taskNames[i]}: ${msg}`);
            console.warn(`📡 ⚠️ ${taskNames[i]} failed for "${server.name}": ${msg}`);
        } else {
            succeeded.push(taskNames[i]);
        }
    }

    // Write a summary log entry to the database
    if (failed.length > 0 && failed.length < taskNames.length) {
        await prisma.log.create({
            data: {
                message: `Poll partial: OK=[${succeeded.join(", ")}] FAIL=[${failed.join("; ")}]`,
                severity: "WARN",
                serverId: server.id,
            },
        }).catch(() => { });
    }

    if (failed.length === taskNames.length) {
        throw new Error(`All polling tasks failed: ${failed.join("; ")}`);
    }
}

// ─── User Stats (auth/me) ─────────────────────────────────────────────────────
// Account-level data (GCL, CPU limit, credits) is now captured directly
// in TickSnapshot from segment 97. We still fetch it for logging purposes.

async function pollUserStats(
    opts: { baseUrl: string; token: string },
    _serverId: string
): Promise<void> {
    const userStats = await fetchUserStats(opts);
    if (!userStats || userStats.ok !== 1) {
        throw new Error(`Failed to fetch user stats from ${opts.baseUrl}`);
    }
    // Data is captured by TickSnapshot (market.credits, gcl.*, cpu.limit)
    // so we just log success here.
    console.log(`📡 User stats OK: GCL=${userStats.gcl}, CPU=${userStats.cpu}`);
}

// ─── Stats Segment (97) + Legacy Memory.stats fallback ────────────────────────

async function pollStatsSegment(
    opts: { baseUrl: string; token: string },
    serverId: string,
    shard: string
): Promise<void> {
    // Try segment 97 first (preferred)
    const rawSegment = await fetchMemorySegment(opts, 97, shard);

    if (rawSegment && rawSegment.trim()) {
        try {
            const parsed = JSON.parse(rawSegment);
            const snapshots = Array.isArray(parsed) ? parsed : [parsed];
            console.log(`📡 Segment 97: found ${snapshots.length} snapshot(s)`);
            await ingestTickStats(snapshots, serverId, shard);
            return;
        } catch (err) {
            console.warn(`📡 Segment 97 parse failed, trying Memory.stats fallback:`, err);
        }
    } else {
        console.log(`📡 Segment 97: empty or not set (shard=${shard}), trying Memory.stats fallback`);
    }

    // Fallback: try Memory.stats (legacy mode, gz-encoded)
    const memStats = await fetchMemoryStats(opts, shard);
    if (memStats) {
        console.log(`📡 Memory.stats fallback: got data with ${Object.keys(memStats).length} keys`);
        await ingestTickStats([memStats], serverId, shard);
    } else {
        console.log(`📡 Memory.stats fallback: also empty — no tick stats available`);
    }
}

// Helper to safely extract a number from the flat snapshot
function num(snapshot: Record<string, unknown>, key: string): number {
    const v = snapshot[key];
    return typeof v === "number" ? v : 0;
}

async function ingestTickStats(
    snapshots: Record<string, unknown>[],
    serverId: string,
    shard: string
): Promise<void> {
    let ingested = 0;

    for (const snapshot of snapshots) {
        if (!snapshot || typeof snapshot !== "object") continue;

        const tick = typeof snapshot.tick === "number"
            ? snapshot.tick
            : typeof snapshot.tick === "string"
                ? parseInt(snapshot.tick, 10)
                : 0;

        if (!tick) continue;

        // ── Extract per-room metrics ──
        const roomsMap = new Map<string, Record<string, number>>();
        // ── Extract per-process CPU ──
        const processes: { processName: string; cpuUsed: number }[] = [];
        // ── Extract per-role creep counts ──
        const creepRoles: { roleName: string; count: number }[] = [];

        for (const [key, val] of Object.entries(snapshot)) {
            if (typeof val !== "number") continue;

            if (key.startsWith("rooms.")) {
                const parts = key.split(".");
                if (parts.length >= 3) {
                    const roomName = parts[1];
                    const metric = parts.slice(2).join(".");
                    if (!roomsMap.has(roomName)) roomsMap.set(roomName, {});
                    roomsMap.get(roomName)![metric] = val;
                }
            } else if (key.startsWith("processes.")) {
                processes.push({
                    processName: key.replace("processes.", ""),
                    cpuUsed: val,
                });
            } else if (key.startsWith("creeps.roles.")) {
                creepRoles.push({
                    roleName: key.replace("creeps.roles.", ""),
                    count: Math.round(val),
                });
            }
        }

        // Build room snapshot creates
        const roomCreates = Array.from(roomsMap.entries()).map(([roomName, metrics]) => ({
            roomName,
            energyAvailable: Math.round(metrics.energyAvailable ?? 0),
            energyCapacity: Math.round(metrics.energyCapacity ?? 0),
            controllerLevel: Math.round(metrics.controllerLevel ?? 0),
            controllerProgress: BigInt(Math.round(metrics.controllerProgress ?? 0)),
            controllerProgressTotal: BigInt(Math.round(metrics.controllerProgressTotal ?? 0)),
            storageEnergy: Math.round(metrics.storageEnergy ?? 0),
            terminalEnergy: Math.round(metrics.terminalEnergy ?? 0),
            creepCount: Math.round(metrics.creepCount ?? 0),
            hostileCount: Math.round(metrics.hostileCount ?? 0),
        }));

        try {
            // Use upsert to handle dedup, with nested creates for child tables
            await prisma.tickSnapshot.upsert({
                where: {
                    serverId_tick_shard: { serverId, tick, shard },
                },
                create: {
                    tick,
                    shard,
                    serverId,

                    // CPU
                    cpuUsed: num(snapshot, "cpu.used"),
                    cpuLimit: Math.round(num(snapshot, "cpu.limit")),
                    cpuBucket: Math.round(num(snapshot, "cpu.bucket")),
                    cpuTickLimit: Math.round(num(snapshot, "cpu.tickLimit")),

                    // GCL / GPL
                    gclLevel: Math.round(num(snapshot, "gcl.level")),
                    gclProgress: num(snapshot, "gcl.progress"),
                    gclProgressTotal: num(snapshot, "gcl.progressTotal"),
                    gplLevel: Math.round(num(snapshot, "gpl.level")),
                    gplProgress: num(snapshot, "gpl.progress"),
                    gplProgressTotal: num(snapshot, "gpl.progressTotal"),

                    // Heap
                    heapUsed: BigInt(Math.round(num(snapshot, "heap.used"))),
                    heapLimit: BigInt(Math.round(num(snapshot, "heap.limit"))),
                    heapRatio: num(snapshot, "heap.ratio"),

                    // Market
                    marketCredits: Math.round(num(snapshot, "market.credits")),
                    marketActiveOrders: Math.round(num(snapshot, "market.activeOrders")),

                    // Creeps
                    creepsMy: Math.round(num(snapshot, "creeps.my")),
                    creepsHostile: Math.round(num(snapshot, "creeps.hostile")),

                    // Spawns
                    spawnsTotal: Math.round(num(snapshot, "spawns.total")),
                    spawnsActive: Math.round(num(snapshot, "spawns.active")),
                    spawnsUtilization: num(snapshot, "spawns.utilization"),

                    // Defense
                    defenseTowerCount: Math.round(num(snapshot, "defense.towerCount")),
                    defenseTowerEnergy: Math.round(num(snapshot, "defense.towerEnergy")),
                    defenseRampartCount: Math.round(num(snapshot, "defense.rampartCount")),
                    defenseRampartMinHits: BigInt(Math.round(num(snapshot, "defense.rampartMinHits"))),

                    // ErrorMapper
                    errorMapperTotalErrors: Math.round(num(snapshot, "errorMapper.totalErrors")),
                    errorMapperMappedCount: Math.round(num(snapshot, "errorMapper.mappedCount")),
                    errorMapperRawCount: Math.round(num(snapshot, "errorMapper.rawCount")),
                    errorMapperCpuUsed: num(snapshot, "errorMapper.cpuUsed"),
                    errorMapperUniqueFingerprints: Math.round(num(snapshot, "errorMapper.uniqueFingerprints")),
                    errorMapperDeferredQueue: Math.round(num(snapshot, "errorMapper.deferredQueue")),
                    errorMapperInResetLoop: Math.round(num(snapshot, "errorMapper.inResetLoop")),

                    // Cache
                    cacheSize: Math.round(num(snapshot, "cache.size")),
                    cacheDirtyCount: Math.round(num(snapshot, "cache.dirtyCount")),
                    cachePathCacheSize: Math.round(num(snapshot, "cache.pathCacheSize")),
                    cacheHeapRatio: num(snapshot, "cache.heapRatio"),
                    cacheEvictedThisTick: Math.round(num(snapshot, "cache.evictedThisTick")),
                    cacheCommitCPU: num(snapshot, "cache.commitCPU"),
                    cacheSchemaVersion: Math.round(num(snapshot, "cache.schemaVersion")),
                    cacheBucketThrottled: Math.round(num(snapshot, "cache.bucketThrottled")),

                    // Child tables
                    roomSnapshots: { create: roomCreates },
                    processSnapshots: { create: processes },
                    creepRoles: { create: creepRoles },
                },
                update: {}, // Already exists, no-op
            });
            ingested++;
        } catch (err) {
            console.warn(`📡 Skip tick ${tick}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    const skipped = snapshots.length - ingested;
    console.log(`📡 Tick stats: ingested=${ingested}, skipped/dupes=${skipped}, total=${snapshots.length}`);
}

// ─── FlightRecorder (Segments 98 & 99) ────────────────────────────────────────

async function pollFlightRecorder(
    opts: { baseUrl: string; token: string },
    serverId: string,
    shard: string,
    segmentId: 96 | 98 | 99
): Promise<void> {
    let rawSegment = await fetchMemorySegment(opts, segmentId, shard);
    if (!rawSegment || !rawSegment.trim()) {
        console.log(`📡 Segment ${segmentId}: empty or not set (shard=${shard})`);
        return;
    }

    // Segment 99 may be base-65536 packed
    if (segmentId === 99 && rawSegment.startsWith("P")) {
        try {
            rawSegment = decodeBase65536(rawSegment);
        } catch (err) {
            console.warn(`📡 Base-65536 decode failed for segment 99:`, err);
            return;
        }
    }

    let parsed: { head?: number; totalWrites?: number; entries?: unknown[] };
    try {
        parsed = JSON.parse(rawSegment);
    } catch (err) {
        console.warn(`📡 Segment ${segmentId}: not valid JSON (length=${rawSegment.length})`);
        return;
    }

    if (!parsed.entries || !Array.isArray(parsed.entries)) {
        console.log(`📡 Segment ${segmentId}: JSON parsed but no .entries array (keys: ${Object.keys(parsed).join(", ")})`);
        return;
    }

    // Rebuild chronological order from circular buffer
    const entries = parsed.entries;
    const head = parsed.head ?? 0;
    const ordered: unknown[] = [];

    for (let i = 0; i < entries.length; i++) {
        const idx = (head + i) % entries.length;
        if (entries[idx] != null) {
            ordered.push(entries[idx]);
        }
    }

    let ingested = 0;
    for (const entry of ordered) {
        if (!entry || typeof entry !== "object") continue;
        const e = entry as Record<string, unknown>;

        const tick = typeof e.t === "number" ? e.t : 0;
        const severity = typeof e.s === "string" ? e.s : "I";
        const context = typeof e.c === "string" ? e.c : "unknown";
        const message = typeof e.m === "string" ? e.m : "";

        if (!tick || !message) continue;

        // Compute dedup hash: MD5(serverId|tick|segment|context|message)
        const dedupHash = crypto
            .createHash("md5")
            .update(`${serverId}|${tick}|${segmentId}|${context}|${message}`)
            .digest("hex");

        try {
            await prisma.flightRecorderEntry.upsert({
                where: { dedupHash },
                create: {
                    tick,
                    severity,
                    context,
                    message,
                    stackTrace: typeof e.st === "string" ? e.st : null,
                    room: typeof e.r === "string" ? e.r : null,
                    correlationId: typeof e.cid === "string" ? e.cid : null,
                    segment: segmentId,
                    dedupHash,
                    serverId,
                },
                update: {}, // Already exists, no-op
            });
            ingested++;
        } catch {
            // Silently skip duplicates
        }
    }

    const skipped = ordered.length - ingested;
    console.log(`📡 Segment ${segmentId}: ingested=${ingested}, skipped/dupes=${skipped}, buffer_size=${entries.length}`);
}

/**
 * Decode base-65536 packed data.
 * Format: P<byteLength>:<packedChars>
 * Each char in the packed portion encodes two bytes.
 */
function decodeBase65536(raw: string): string {
    const colonIdx = raw.indexOf(":");
    if (colonIdx === -1) throw new Error("Invalid base-65536 format: no colon");

    const byteLength = parseInt(raw.slice(1, colonIdx), 10);
    const packed = raw.slice(colonIdx + 1);
    const bytes = new Uint8Array(byteLength);

    for (let i = 0; i < packed.length; i++) {
        const code = packed.charCodeAt(i);
        const byteIdx = i * 2;
        if (byteIdx < byteLength) bytes[byteIdx] = code >> 8;
        if (byteIdx + 1 < byteLength) bytes[byteIdx + 1] = code & 0xff;
    }

    return new TextDecoder().decode(bytes);
}
