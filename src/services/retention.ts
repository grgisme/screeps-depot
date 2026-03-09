import prisma from "../lib/prisma.js";
import cron from "node-cron";

const DEFAULT_RETENTION_HOURS = 48;

export interface RetentionResult {
    tickStats: number;
    flightRecorder: number;
    stats: number;
    logs: number;
    cutoff: string;
    durationMs: number;
}

/**
 * Delete rows older than `retentionHours` from all time-series tables.
 * Returns a summary of how many rows were deleted from each table.
 */
export async function pruneOldData(
    retentionHours: number = DEFAULT_RETENTION_HOURS
): Promise<RetentionResult> {
    const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000);
    const start = Date.now();

    console.log(`🧹 Retention: pruning data older than ${cutoff.toISOString()} (${retentionHours}h window)...`);

    // Run deletions in parallel — each table is independent
    const [tickStats, flightRecorder, stats, logs] = await Promise.all([
        prisma.tickStat.deleteMany({
            where: { recordedAt: { lt: cutoff } },
        }),
        prisma.flightRecorderEntry.deleteMany({
            where: { recordedAt: { lt: cutoff } },
        }),
        prisma.stat.deleteMany({
            where: { recordedAt: { lt: cutoff } },
        }),
        prisma.log.deleteMany({
            where: { timestamp: { lt: cutoff } },
        }),
    ]);

    const durationMs = Date.now() - start;

    console.log(
        `🧹 Retention complete in ${durationMs}ms: ` +
        `TickStat=${tickStats.count}, FlightRecorder=${flightRecorder.count}, ` +
        `Stat=${stats.count}, Log=${logs.count}`
    );

    return {
        tickStats: tickStats.count,
        flightRecorder: flightRecorder.count,
        stats: stats.count,
        logs: logs.count,
        cutoff: cutoff.toISOString(),
        durationMs,
    };
}

/**
 * Get current row counts for all time-series tables.
 * Useful for monitoring database growth.
 */
export async function getTableCounts(): Promise<{
    tickStats: number;
    flightRecorder: number;
    stats: number;
    logs: number;
}> {
    const [tickStats, flightRecorder, stats, logs] = await Promise.all([
        prisma.tickStat.count(),
        prisma.flightRecorderEntry.count(),
        prisma.stat.count(),
        prisma.log.count(),
    ]);

    return { tickStats, flightRecorder, stats, logs };
}

/**
 * Start the retention cron job.
 * Runs once per hour to prune data older than DATA_RETENTION_HOURS (default: 48).
 */
export function startRetentionCron(): void {
    const retentionHours = parseInt(
        process.env.DATA_RETENTION_HOURS || String(DEFAULT_RETENTION_HOURS),
        10
    );

    console.log(`🧹 Retention cron scheduled: every hour, keeping ${retentionHours}h of data`);

    // Run once on startup (with a short delay to let the DB connection settle)
    setTimeout(() => {
        pruneOldData(retentionHours).catch((err) => {
            console.error("🧹 Retention startup run failed:", err);
        });
    }, 10_000);

    // Then run every hour at minute 0
    cron.schedule("0 * * * *", async () => {
        try {
            await pruneOldData(retentionHours);
        } catch (err) {
            console.error("🧹 Retention cron error:", err);
        }
    });
}
