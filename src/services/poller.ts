import cron from "node-cron";
import prisma from "../lib/prisma.js";
import { fetchUserStats } from "./screepsApi.js";

const DEFAULT_CRON = "*/15 * * * *"; // Every 15 minutes

/**
 * Start the background polling service.
 *
 * On each tick, queries all ScreepsServer entries where polling is enabled
 * and an API token is configured. For each server, fetches stats from the
 * Screeps Web API and saves the results to the Stat and Log tables.
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
 * Poll a single Screeps server: fetch user stats and save them.
 */
async function pollServer(server: {
    id: string;
    name: string;
    apiToken: string | null;
    apiBaseUrl: string;
}): Promise<void> {
    if (!server.apiToken) return;

    const opts = {
        baseUrl: server.apiBaseUrl,
        token: server.apiToken,
    };

    // ─── Fetch user stats (GCL, CPU, credits) ──────────────────────────────
    const userStats = await fetchUserStats(opts);

    if (userStats && userStats.ok === 1) {
        await prisma.stat.create({
            data: {
                data: {
                    type: "userStats",
                    username: userStats.user.username,
                    gcl: userStats.user.gcl,
                    cpu: userStats.user.cpu,
                    credits: userStats.user.credits ?? 0,
                },
                serverId: server.id,
            },
        });

        // Log successful poll
        await prisma.log.create({
            data: {
                message: `Polled user stats: GCL=${userStats.user.gcl}, CPU=${userStats.user.cpu}`,
                severity: "INFO",
                serverId: server.id,
            },
        });
    } else {
        throw new Error(`Failed to fetch user stats from ${server.apiBaseUrl}`);
    }
}
