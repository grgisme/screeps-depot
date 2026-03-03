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
    pollingEnabled: boolean;
    createdAt: string;
}

export function getServers(token: string) {
    return apiFetch<Server[]>("/api/servers", { token });
}

export function createServer(
    token: string,
    data: { name: string; apiToken?: string; apiBaseUrl?: string; pollingEnabled?: boolean }
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
    data: { name?: string; apiToken?: string; apiBaseUrl?: string; pollingEnabled?: boolean }
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
