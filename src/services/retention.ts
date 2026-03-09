import prisma from "../lib/prisma.js";
import cron from "node-cron";

const DEFAULT_RETENTION_HOURS = 48;
const DEFAULT_CONSOLE_RETENTION_HOURS = 6;
const MAX_DB_SIZE_MB = 400; // Railway limit is 500MB, keep 100MB buffer
const MIN_EXPAND_DB_SIZE_MB = 200; // If below this, we can store more history

export interface RetentionResult {
    consoleOutput: number;
    flightRecorder: number;
    tickSnapshots: number;
    logs: number;
    retentionHours: number;
    consoleRetentionHours: number;
    cutoff: string;
    consoleCutoff: string;
    durationMs: number;
}

/**
 * Fetch dynamic retention settings from the database, falling back to ENV/defaults.
 */
export async function getRetentionSettings(): Promise<{ retentionHours: number, consoleRetentionHours: number }> {
    try {
        const setting = await prisma.systemSetting.findUnique({
            where: { key: "retention_config" }
        });
        if (setting && setting.value && typeof setting.value === "object") {
            const val = setting.value as Record<string, unknown>;
            if (typeof val.retentionHours === "number" && typeof val.consoleRetentionHours === "number") {
                return {
                    retentionHours: val.retentionHours,
                    consoleRetentionHours: val.consoleRetentionHours
                };
            }
        }
    } catch (err) {
        console.warn("Could not read retention_config from SystemSetting:", err);
    }

    // Fallback to Env vars or defaults
    return {
        retentionHours: parseInt(process.env.DATA_RETENTION_HOURS || String(DEFAULT_RETENTION_HOURS), 10),
        consoleRetentionHours: parseInt(process.env.CONSOLE_RETENTION_HOURS || String(DEFAULT_CONSOLE_RETENTION_HOURS), 10)
    };
}

/**
 * Delete rows older than their respective retention windows.
 */
export async function pruneOldData(
    retentionHours?: number,
    consoleRetentionHours?: number
): Promise<RetentionResult> {
    if (retentionHours === undefined || consoleRetentionHours === undefined) {
        const settings = await getRetentionSettings();
        retentionHours = retentionHours ?? settings.retentionHours;
        consoleRetentionHours = consoleRetentionHours ?? settings.consoleRetentionHours;
    }

    const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000);
    const consoleCutoff = new Date(Date.now() - consoleRetentionHours * 60 * 60 * 1000);
    const start = Date.now();

    console.log(
        `🧹 Retention: pruning console output older than ${consoleCutoff.toISOString()} (${consoleRetentionHours}h), ` +
        `everything else older than ${cutoff.toISOString()} (${retentionHours}h)...`
    );

    const [consoleOutput, flightRecorder, tickSnapshots, logs] = await Promise.all([
        prisma.flightRecorderEntry.deleteMany({
            where: { segment: 96, recordedAt: { lt: consoleCutoff } },
        }),
        prisma.flightRecorderEntry.deleteMany({
            where: { segment: { not: 96 }, recordedAt: { lt: cutoff } },
        }),
        prisma.tickSnapshot.deleteMany({
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
        `TickSnapshot=${tickSnapshots.count}, Log=${logs.count}`
    );

    return {
        consoleOutput: consoleOutput.count,
        flightRecorder: flightRecorder.count,
        tickSnapshots: tickSnapshots.count,
        logs: logs.count,
        retentionHours,
        consoleRetentionHours,
        cutoff: cutoff.toISOString(),
        consoleCutoff: consoleCutoff.toISOString(),
        durationMs,
    };
}

/**
 * Run a raw query to measure the physical byte size of all tables and indexes.
 * Writes the result to SystemDiagnostic.
 */
export async function measureDatabaseSize(): Promise<{ totalBytes: number, tables: Record<string, number> }> {
    try {
        const rows = await prisma.$queryRawUnsafe<{ tableName: string, sizeBytes: string | number }[]>(`
            SELECT relname as "tableName", pg_total_relation_size(cast(relid as regclass)) as "sizeBytes"
            FROM pg_catalog.pg_statio_user_tables;
        `);

        let totalBytes = 0;
        const tables: Record<string, number> = {};

        for (const row of rows) {
            const size = typeof row.sizeBytes === "bigint" ? Number(row.sizeBytes) : Number(row.sizeBytes);
            tables[row.tableName] = size;
            totalBytes += size;
        }

        const sizeMB = (totalBytes / 1024 / 1024).toFixed(2);
        console.log(`📊 Measured DB Size: ${sizeMB} MB`);

        // Save diagnostic
        await prisma.systemDiagnostic.create({
            data: {
                type: "db_table_sizes",
                data: {
                    totalBytes,
                    totalMB: Number(sizeMB),
                    tables
                }
            }
        });

        return { totalBytes, tables };
    } catch (err) {
        console.error("Failed to measure database size:", err);
        return { totalBytes: 0, tables: {} };
    }
}

/**
 * Auto-tunes the retention hours based on the measured DB size.
 */
export async function tuneRetentionSettings(): Promise<void> {
    const { totalBytes } = await measureDatabaseSize();
    if (totalBytes === 0) return; // Measurement failed

    const totalMB = totalBytes / 1024 / 1024;
    const { retentionHours, consoleRetentionHours } = await getRetentionSettings();
    let newRetention = retentionHours;
    let newConsole = consoleRetentionHours;

    let changed = false;

    if (totalMB > MAX_DB_SIZE_MB) {
        // Need to shrink
        console.log(`⚠️ DB Size (${totalMB.toFixed(1)}MB) exceeds max (${MAX_DB_SIZE_MB}MB). Shrinking retention.`);
        newConsole = Math.max(2, consoleRetentionHours - 2); // Shrink console by 2h, min 2h
        newRetention = Math.max(24, retentionHours - 12);     // Shrink data by 12h, min 24h
        changed = true;
    } else if (totalMB < MIN_EXPAND_DB_SIZE_MB) {
        // We have plenty of room, can store more history
        console.log(`📈 DB Size (${totalMB.toFixed(1)}MB) is below expand threshold (${MIN_EXPAND_DB_SIZE_MB}MB). Expanding retention.`);
        newConsole = Math.min(48, consoleRetentionHours + 2); // Grow console by 2h, max 48h
        newRetention = Math.min(336, retentionHours + 12);     // Grow data by 12h, max 336h (14 days)
        changed = true;
    }

    if (changed) {
        console.log(`🔧 Autotuned retention: console ${consoleRetentionHours}h -> ${newConsole}h, data ${retentionHours}h -> ${newRetention}h`);
        await prisma.systemSetting.upsert({
            where: { key: "retention_config" },
            create: {
                key: "retention_config",
                value: { retentionHours: newRetention, consoleRetentionHours: newConsole }
            },
            update: {
                value: { retentionHours: newRetention, consoleRetentionHours: newConsole }
            }
        });
    } else {
        console.log(`✅ DB Size (${totalMB.toFixed(1)}MB) is healthy. Keeping retention: console ${consoleRetentionHours}h, data ${retentionHours}h`);
    }
}

/**
 * Get current row counts for all time-series tables.
 */
export async function getTableCounts(): Promise<{
    tickSnapshots: number;
    roomSnapshots: number;
    processSnapshots: number;
    creepRoleSnapshots: number;
    flightRecorder: number;
    consoleOutput: number;
    logs: number;
}> {
    const [tickSnapshots, roomSnapshots, processSnapshots, creepRoleSnapshots,
        flightRecorder, consoleOutput, logs] = await Promise.all([
            prisma.tickSnapshot.count(),
            prisma.roomSnapshot.count(),
            prisma.processSnapshot.count(),
            prisma.creepRoleSnapshot.count(),
            prisma.flightRecorderEntry.count({ where: { segment: { not: 96 } } }),
            prisma.flightRecorderEntry.count({ where: { segment: 96 } }),
            prisma.log.count(),
        ]);

    return {
        tickSnapshots, roomSnapshots, processSnapshots, creepRoleSnapshots,
        flightRecorder, consoleOutput, logs
    };
}

/**
 * Start the retention cron job.
 */
export function startRetentionCron(): void {
    console.log(`🧹 Retention & Auto-Tuning cron initialized`);

    // Run once on startup
    setTimeout(async () => {
        try {
            await tuneRetentionSettings(); // First measure & tune
            await pruneOldData();          // Then prune with (potentially new) settings
        } catch (err) {
            console.error("🧹 Retention startup run failed:", err);
        }
    }, 10_000);

    // Prune every hour at minute 0
    cron.schedule("0 * * * *", async () => {
        try {
            await pruneOldData();
        } catch (err) {
            console.error("🧹 Retention cron error:", err);
        }
    });

    // Measure & Tune twice a day (at noon and midnight)
    cron.schedule("0 0,12 * * *", async () => {
        try {
            await tuneRetentionSettings();
        } catch (err) {
            console.error("🔧 Auto-tune cron error:", err);
        }
    });
}
