const API_BASE = "";

interface ApiOptions {
    method?: string;
    body?: unknown;
    token?: string;
}

export async function apiFetch<T>(
    path: string,
    opts: ApiOptions = {}
): Promise<T> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    if (opts.token) {
        headers["Authorization"] = `Bearer ${opts.token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
        method: opts.method || "GET",
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }

    if (res.status === 204) return undefined as T;
    return res.json();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthResponse {
    token: string;
    userId: string;
}

export function login(username: string, password: string) {
    return apiFetch<AuthResponse>("/api/auth/login", {
        method: "POST",
        body: { username, password },
    });
}

export function register(username: string, password: string) {
    return apiFetch<AuthResponse>("/api/auth/register", {
        method: "POST",
        body: { username, password },
    });
}

// ─── Servers ──────────────────────────────────────────────────────────────────
export interface Server {
    id: string;
    name: string;
    apiToken: string | null;
    pushToken: string;
    apiBaseUrl: string;
    shard: string;
    pollingEnabled: boolean;
    createdAt: string;
}

export function getServers(token: string) {
    return apiFetch<Server[]>("/api/servers", { token });
}

export function createServer(
    token: string,
    data: { name: string; apiToken?: string; apiBaseUrl?: string; shard?: string; pollingEnabled?: boolean }
) {
    return apiFetch<Server>("/api/servers", {
        method: "POST",
        body: data,
        token,
    });
}

export function updateServer(
    token: string,
    serverId: string,
    data: { name?: string; apiToken?: string; apiBaseUrl?: string; shard?: string; pollingEnabled?: boolean }
) {
    return apiFetch<Server>(`/api/servers/${serverId}`, {
        method: "PATCH",
        body: data,
        token,
    });
}

export function deleteServer(token: string, serverId: string) {
    return apiFetch<void>(`/api/servers/${serverId}`, {
        method: "DELETE",
        token,
    });
}

export function regeneratePushToken(token: string, serverId: string) {
    return apiFetch<{ pushToken: string }>(`/api/servers/${serverId}/regenerate-token`, {
        method: "POST",
        token,
    });
}

export function pollNow(token: string, serverId: string) {
    return apiFetch<{ ok: boolean; message: string }>(`/api/servers/${serverId}/poll-now`, {
        method: "POST",
        token,
    });
}

// ─── Stats ────────────────────────────────────────────────────────────────────
export interface Stat {
    id: string;
    data: Record<string, unknown>;
    recordedAt: string;
    serverId: string;
}

export function getServerStats(token: string, serverId: string) {
    return apiFetch<Stat[]>(`/api/servers/${serverId}/stats`, { token });
}

// ─── Logs ─────────────────────────────────────────────────────────────────────
export interface Log {
    id: string;
    message: string;
    severity: "INFO" | "WARN" | "ERROR";
    timestamp: string;
    serverId: string;
}

export function getServerLogs(
    token: string,
    serverId: string,
    severity?: string
) {
    const q = severity ? `?severity=${severity}` : "";
    return apiFetch<Log[]>(`/api/servers/${serverId}/logs${q}`, { token });
}

// ─── Dashboard Charts ─────────────────────────────────────────────────────────
export interface DashboardStatsResponse {
    chartData: Record<string, unknown>[];
    series: Record<string, { time: string; value: number }[]>;
    availableMetrics: string[];
    serverName: string;
    from: string;
    to: string;
    totalPoints: number;
}

export function getDashboardStats(
    token: string,
    serverId: string,
    hours: number = 24
) {
    return apiFetch<DashboardStatsResponse>(
        `/api/dashboard/stats?serverId=${serverId}&hours=${hours}`,
        { token }
    );
}

// ─── Dashboard Logs ───────────────────────────────────────────────────────────
export interface DashboardLogsResponse {
    logs: Log[];
    total: number;
    limit: number;
    offset: number;
}

export function getDashboardLogs(
    token: string,
    serverId: string,
    opts: { limit?: number; offset?: number; severity?: string; search?: string } = {}
) {
    const params = new URLSearchParams({ serverId });
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.offset) params.set("offset", String(opts.offset));
    if (opts.severity) params.set("severity", opts.severity);
    if (opts.search) params.set("search", opts.search);
    return apiFetch<DashboardLogsResponse>(
        `/api/dashboard/logs?${params.toString()}`,
        { token }
    );
}

// ─── Tick Stats (Segment 97 data) ─────────────────────────────────────────────

export interface TickStatsResponse {
    chartData: Record<string, unknown>[];
    availableMetrics: string[];
    totalPoints: number;
    serverName: string;
    from: string;
    to: string;
}

export function getTickStats(
    token: string,
    serverId: string,
    hours: number = 24,
    metrics?: string[]
) {
    const params = new URLSearchParams({ serverId, hours: String(hours) });
    if (metrics?.length) params.set("metrics", metrics.join(","));
    return apiFetch<TickStatsResponse>(
        `/api/tick-stats?${params.toString()}`,
        { token }
    );
}

export interface TickStatsLatest {
    tick: number;
    shard: string;
    recordedAt: string;
    data: Record<string, unknown>;
}

export function getTickStatsLatest(token: string, serverId: string) {
    return apiFetch<TickStatsLatest | { data: null }>(
        `/api/tick-stats/latest?serverId=${serverId}`,
        { token }
    );
}

export interface RoomsResponse {
    tick: number;
    recordedAt: string;
    rooms: Record<string, Record<string, unknown>>;
}

export function getTickStatsRooms(token: string, serverId: string) {
    return apiFetch<RoomsResponse>(
        `/api/tick-stats/rooms?serverId=${serverId}`,
        { token }
    );
}

export interface ProcessesResponse {
    chartData: Record<string, unknown>[];
    processes: string[];
    totalPoints: number;
}

export function getTickStatsProcesses(
    token: string,
    serverId: string,
    hours: number = 1
) {
    return apiFetch<ProcessesResponse>(
        `/api/tick-stats/processes?serverId=${serverId}&hours=${hours}`,
        { token }
    );
}

// ─── Flight Recorder ──────────────────────────────────────────────────────────

export interface FlightRecorderEntryDTO {
    id: string;
    tick: number;
    severity: string;
    context: string;
    message: string;
    stackTrace: string | null;
    room: string | null;
    correlationId: string | null;
    segment: number;
    recordedAt: string;
}

export interface FlightRecorderResponse {
    entries: FlightRecorderEntryDTO[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export function getFlightRecorderEntries(
    token: string,
    serverId: string,
    opts: { severity?: string; context?: string; room?: string; page?: number; limit?: number } = {}
) {
    const params = new URLSearchParams({ serverId });
    if (opts.severity) params.set("severity", opts.severity);
    if (opts.context) params.set("context", opts.context);
    if (opts.room) params.set("room", opts.room);
    if (opts.page) params.set("page", String(opts.page));
    if (opts.limit) params.set("limit", String(opts.limit));
    return apiFetch<FlightRecorderResponse>(
        `/api/flight-recorder?${params.toString()}`,
        { token }
    );
}

export interface FlightRecorderSummary {
    lastHour: Record<string, number>;
    lastDay: Record<string, number>;
}

export function getFlightRecorderSummary(token: string, serverId: string) {
    return apiFetch<FlightRecorderSummary>(
        `/api/flight-recorder/summary?serverId=${serverId}`,
        { token }
    );
}

// ─── Energy Stats ─────────────────────────────────────────────────────────────

export interface EnergyResponse {
    chartData: Record<string, unknown>[];
    rooms: string[];
    totalPoints: number;
    from: string;
    to: string;
}

export function getTickStatsEnergy(
    token: string,
    serverId: string,
    hours: number = 24
) {
    return apiFetch<EnergyResponse>(
        `/api/tick-stats/energy?serverId=${serverId}&hours=${hours}`,
        { token }
    );
}
