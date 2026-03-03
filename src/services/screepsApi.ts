/**
 * Screeps Web API client.
 *
 * Wraps the HTTP endpoints exposed by the official Screeps game server.
 * All requests authenticate via the X-Token header.
 */

import { gunzipSync } from "node:zlib";

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

interface SegmentResponse {
    ok: number;
    data: string; // Raw string content of the segment
}

interface UserStatsResponse {
    ok: number;
    username: string;
    gcl: number;
    gclLevel?: number;
    cpu: number;
    cpuAvailable?: number;
    credits?: number;
    [key: string]: unknown;
}

interface WorldStatusResponse {
    ok: number;
    status: string; // "normal", "lost", "empty"
}

interface GameTimeResponse {
    ok: number;
    time: number;
}

// ─── Room Overview ────────────────────────────────────────────────────────────

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

// ─── Memory ───────────────────────────────────────────────────────────────────

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
 * Fetch and decode Memory.stats (legacy mode).
 * Handles the gz: prefix: base64 decode → gunzip → JSON.parse.
 */
export async function fetchMemoryStats(
    opts: ScreepsApiOptions,
    shard?: string
): Promise<Record<string, unknown> | null> {
    const response = await fetchMemoryPath(opts, "stats", shard);
    if (!response || response.ok !== 1 || !response.data) return null;

    try {
        return decodeMemoryData(response.data);
    } catch (err) {
        console.error("Failed to decode Memory.stats:", err);
        return null;
    }
}

/**
 * Decode Screeps memory data (handles gz: prefix).
 */
function decodeMemoryData(data: string): Record<string, unknown> {
    if (data.startsWith("gz:")) {
        const b64 = data.slice(3);
        const buf = Buffer.from(b64, "base64");
        const decompressed = gunzipSync(buf);
        return JSON.parse(decompressed.toString("utf-8"));
    }
    // Plain JSON
    return JSON.parse(data);
}

// ─── Segments ─────────────────────────────────────────────────────────────────

/**
 * Fetch a raw memory segment.
 * Endpoint: GET /api/user/memory-segment?segment=N&shard=<shard>
 */
export async function fetchMemorySegment(
    opts: ScreepsApiOptions,
    segmentId: number,
    shard?: string
): Promise<string | null> {
    const url = new URL("/api/user/memory-segment", opts.baseUrl);
    url.searchParams.set("segment", String(segmentId));
    if (shard) url.searchParams.set("shard", shard);

    const result = await fetchScreeps<SegmentResponse>(url, opts.token);
    if (!result || result.ok !== 1) return null;
    return result.data ?? null;
}

// ─── User Info ────────────────────────────────────────────────────────────────

/**
 * Fetch user info including GCL, CPU, credits.
 * Endpoint: GET /api/auth/me (undocumented but used by all community tools)
 */
export async function fetchUserStats(
    opts: ScreepsApiOptions
): Promise<UserStatsResponse | null> {
    const url = new URL("/api/auth/me", opts.baseUrl);
    const result = await fetchScreeps<UserStatsResponse>(url, opts.token);

    if (result) {
        if (result.ok !== 1) {
            console.error(`Screeps /api/auth/me returned ok=${result.ok}`);
            return null;
        }
        if (!result.username) {
            console.error(
                `Screeps /api/auth/me response missing expected fields. Keys: [${Object.keys(result).join(", ")}]`
            );
            return null;
        }
    }

    return result;
}

// ─── World Status & Game Time ─────────────────────────────────────────────────

/**
 * Fetch world status (normal/lost/empty).
 * Endpoint: GET /api/user/world-status
 */
export async function fetchWorldStatus(
    opts: ScreepsApiOptions
): Promise<WorldStatusResponse | null> {
    const url = new URL("/api/user/world-status", opts.baseUrl);
    return fetchScreeps<WorldStatusResponse>(url, opts.token);
}

/**
 * Fetch the current game tick.
 * Endpoint: GET /api/game/time
 */
export async function fetchGameTime(
    opts: ScreepsApiOptions
): Promise<number | null> {
    const url = new URL("/api/game/time", opts.baseUrl);
    const result = await fetchScreeps<GameTimeResponse>(url, opts.token);
    return result?.ok === 1 ? result.time : null;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Make an authenticated GET request to the Screeps API.
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

        if (response.status === 429) {
            const retryAfter = response.headers.get("Retry-After") || "unknown";
            console.error(
                `Screeps API rate limited (429) for ${url.pathname}. Retry after: ${retryAfter}ms`
            );
            return null;
        }

        if (!response.ok) {
            const body = await response.text().catch(() => "(no body)");
            console.error(
                `Screeps API error: ${response.status} ${response.statusText} for ${url.pathname} — ${body}`
            );
            return null;
        }

        return (await response.json()) as T;
    } catch (err) {
        console.error(`Screeps API fetch failed for ${url.pathname}:`, err);
        return null;
    }
}
