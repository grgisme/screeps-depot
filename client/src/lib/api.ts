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
