/**
 * Screeps Web API client.
 *
 * Wraps the HTTP endpoints exposed by the official Screeps game server.
 * All requests authenticate via the X-Token header.
 */

interface ScreepsApiOptions {
    baseUrl: string;
    token: string;
}

interface RoomOverviewResponse {
    ok: number;
    stats: Record<string, unknown>;
    statsMax: Record<string, unknown>;
    totals: Record<string, number>;
}

interface MemoryResponse {
    ok: number;
    data: string; // gz-encoded or raw JSON prefixed with "gz:"
}

interface UserStatsResponse {
    ok: number;
    user: {
        username: string;
        gcl: number;
        gclLevel?: number;
        cpu: number;
        cpuAvailable?: number;
        credits?: number;
        [key: string]: unknown;
    };
}

/**
 * Fetch room overview stats for a given room.
 * Endpoint: GET /api/game/room-overview?room=<room>&interval=<interval>&shard=<shard>
 */
export async function fetchRoomOverview(
    opts: ScreepsApiOptions,
    room: string,
    interval: number = 8,
    shard?: string
): Promise<RoomOverviewResponse | null> {
    const url = new URL("/api/game/room-overview", opts.baseUrl);
    url.searchParams.set("room", room);
    url.searchParams.set("interval", String(interval));
    if (shard) url.searchParams.set("shard", shard);

    return fetchScreeps<RoomOverviewResponse>(url, opts.token);
}

/**
 * Fetch a memory path from the user's Memory object.
 * Endpoint: GET /api/user/memory?path=<path>&shard=<shard>
 */
export async function fetchMemoryPath(
    opts: ScreepsApiOptions,
    path: string = "",
    shard?: string
): Promise<MemoryResponse | null> {
    const url = new URL("/api/user/memory", opts.baseUrl);
    if (path) url.searchParams.set("path", path);
    if (shard) url.searchParams.set("shard", shard);

    return fetchScreeps<MemoryResponse>(url, opts.token);
}

/**
 * Fetch user info including GCL, CPU, credits.
 * Endpoint: GET /api/auth/me
 */
export async function fetchUserStats(
    opts: ScreepsApiOptions
): Promise<UserStatsResponse | null> {
    const url = new URL("/api/auth/me", opts.baseUrl);
    return fetchScreeps<UserStatsResponse>(url, opts.token);
}

/**
 * Internal helper to make authenticated GET requests to the Screeps API.
 */
async function fetchScreeps<T>(url: URL, token: string): Promise<T | null> {
    try {
        const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
                "X-Token": token,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            console.error(
                `Screeps API error: ${response.status} ${response.statusText} for ${url.pathname}`
            );
            return null;
        }

        return (await response.json()) as T;
    } catch (err) {
        console.error(`Screeps API fetch failed for ${url.pathname}:`, err);
        return null;
    }
}
