import prisma from "../lib/prisma.js";
import cron from "node-cron";

const DEFAULT_RETENTION_HOURS = 48;
const DEFAULT_CONSOLE_RETENTION_HOURS = 6;

export interface RetentionResult {
    consoleOutput: number;
    flightRecorder: number;
    tickStats: number;
    stats: number;
    logs: number;
    cutoff: string;
    consoleCutoff: string;
    durationMs: number;
}

/**
 * Delete rows older than their respective retention windows.
 *
 * - Console output (segment 96): shorter retention (default 6h)
 * - Flight recorder (segments 98/99): standard retention (default 48h)
 * - TickStat, Stat, Log: standard retention (default 48h)
 */
export async function pruneOldData(
    retentionHours: number = DEFAULT_RETENTION_HOURS,
    consoleRetentionHours: number = DEFAULT_CONSOLE_RETENTION_HOURS
): Promise<RetentionResult> {
    const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000);
    const consoleCutoff = new Date(Date.now() - consoleRetentionHours * 60 * 60 * 1000);
    const start = Date.now();

    console.log(
        `🧹 Retention: pruning console output older than ${consoleCutoff.toISOString()} (${consoleRetentionHours}h), ` +
        `everything else older than ${cutoff.toISOString()} (${retentionHours}h)...`
    );

    // Run deletions in parallel — each query is independent
    const [consoleOutput, flightRecorder, tickStats, stats, logs] = await Promise.all([
        // Console output (segment 96) — shorter retention
        prisma.flightRecorderEntry.deleteMany({
            where: {
                segment: 96,
                recordedAt: { lt: consoleCutoff },
            },
        }),
        // Flight recorder (segments 98/99) — standard retention
        prisma.flightRecorderEntry.deleteMany({
            where: {
                segment: { not: 96 },
                recordedAt: { lt: cutoff },
            },
        }),
        prisma.tickStat.deleteMany({
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
        `Console=${consoleOutput.count}, FlightRecorder=${flightRecorder.count}, ` +
        `TickStat=${tickStats.count}, Stat=${stats.count}, Log=${logs.count}`
    );

    return {
        consoleOutput: consoleOutput.count,
        flightRecorder: flightRecorder.count,
        tickStats: tickStats.count,
        stats: stats.count,
        logs: logs.count,
        cutoff: cutoff.toISOString(),
        consoleCutoff: consoleCutoff.toISOString(),
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
    consoleOutput: number;
    stats: number;
    logs: number;
}> {
    const [tickStats, flightRecorder, consoleOutput, stats, logs] = await Promise.all([
        prisma.tickStat.count(),
        prisma.flightRecorderEntry.count({ where: { segment: { not: 96 } } }),
        prisma.flightRecorderEntry.count({ where: { segment: 96 } }),
        prisma.stat.count(),
        prisma.log.count(),
    ]);

    return { tickStats, flightRecorder, consoleOutput, stats, logs };
}

/**
 * Start the retention cron job.
 * Runs once per hour to prune data older than configured retention windows.
 */
export function startRetentionCron(): void {
    const retentionHours = parseInt(
        process.env.DATA_RETENTION_HOURS || String(DEFAULT_RETENTION_HOURS),
        10
    );
    const consoleRetentionHours = parseInt(
        process.env.CONSOLE_RETENTION_HOURS || String(DEFAULT_CONSOLE_RETENTION_HOURS),
        10
    );

    console.log(
        `🧹 Retention cron scheduled: every hour, ` +
        `console=${consoleRetentionHours}h, everything else=${retentionHours}h`
    );

    // Run once on startup (with a short delay to let the DB connection settle)
    setTimeout(() => {
        pruneOldData(retentionHours, consoleRetentionHours).catch((err) => {
            console.error("🧹 Retention startup run failed:", err);
        });
    }, 10_000);

    // Then run every hour at minute 0
    cron.schedule("0 * * * *", async () => {
        try {
            await pruneOldData(retentionHours, consoleRetentionHours);
        } catch (err) {
            console.error("🧹 Retention cron error:", err);
        }
    });
}
