import { useState, useEffect, useCallback } from "react";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { getServerLogs, type Log } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

interface Props {
    serverId: string;
}

const SEVERITY_COLORS: Record<string, string> = {
    INFO: "#3b82f6",
    WARN: "#f59e0b",
    ERROR: "#ef4444",
};

export default function SystemLogsTab({ serverId }: Props) {
    const { token } = useAuth();
    const [logs, setLogs] = useState<Log[]>([]);
    const [severity, setSeverity] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);

    const load = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const res = await getServerLogs(token, serverId, severity || undefined);
            setLogs(res);
        } catch (err) {
            console.error("SystemLogsTab error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [token, serverId, severity]);

    useEffect(() => { load(); }, [load]);
    useAutoRefresh(load);

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-2">
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Severity:</span>
                {["", "INFO", "WARN", "ERROR"].map((s) => (
                    <button key={s} onClick={() => setSeverity(s)}
                        className="rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer transition-all"
                        style={{
                            backgroundColor: severity === s ? (s ? SEVERITY_COLORS[s] : "var(--accent)") : "transparent",
                            color: severity === s ? "#fff" : "var(--text-muted)",
                            border: `1px solid ${severity === s ? (s ? SEVERITY_COLORS[s] : "var(--accent)") : "var(--border)"}`,
                        }}>
                        {s || "ALL"}
                    </button>
                ))}
                <button onClick={load} className="ml-auto rounded-md px-2.5 py-1 text-xs cursor-pointer"
                    style={{ backgroundColor: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                    ↻ Refresh
                </button>
            </div>

            {/* Log entries */}
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                {isLoading ? (
                    <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>Loading...</p>
                ) : logs.length === 0 ? (
                    <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>No system logs found.</p>
                ) : (
                    logs.map((log) => (
                        <div key={log.id} className="flex items-start gap-3 px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded mt-0.5 shrink-0"
                                style={{ backgroundColor: `${SEVERITY_COLORS[log.severity] ?? "#6366f1"}20`, color: SEVERITY_COLORS[log.severity] ?? "#6366f1" }}>
                                {log.severity}
                            </span>
                            <p className="text-sm flex-1 break-words" style={{ color: "var(--text-primary)" }}>{log.message}</p>
                            <span className="text-xs shrink-0 font-mono" style={{ color: "var(--text-muted)" }}>
                                {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
