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
        <div className="space-y-6">
            {/* Filter bar — toggle pills */}
            <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Severity:</span>
                <div className="flex gap-2">
                    {["", "INFO", "WARN", "ERROR"].map((s) => {
                        const isActive = severity === s;
                        const color = s ? SEVERITY_COLORS[s] : "var(--accent)";
                        return (
                            <button key={s} onClick={() => setSeverity(s)}
                                className={`px-4 py-1.5 rounded-full border text-sm cursor-pointer transition-all font-medium ${isActive
                                    ? "text-white border-transparent shadow-md"
                                    : "border-[var(--border-light)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5"
                                    }`}
                                style={isActive ? { backgroundColor: color, boxShadow: s ? `0 4px 12px ${SEVERITY_COLORS[s]}40` : undefined } : {}}
                            >
                                {s || "ALL"}
                            </button>
                        );
                    })}
                </div>
                <div className="flex-1" />
                <button onClick={load} className="glass-panel-interactive px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--text-primary)] hover:text-[var(--accent)] flex items-center gap-1 cursor-pointer">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>
            </div>

            {/* Log entries — dense list */}
            <div className="glass-panel rounded-2xl overflow-hidden relative border border-[var(--border-light)]">
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-30"></div>

                {isLoading ? (
                    <div className="p-12 text-center text-[var(--text-muted)] animate-pulse text-sm">Loading telemetry...</div>
                ) : logs.length === 0 ? (
                    <div className="p-12 text-center text-[var(--text-muted)] text-sm">No system logs found for this filter.</div>
                ) : (
                    <div>
                        {logs.map((log, idx) => (
                            <div key={log.id} className={`flex items-start gap-4 py-2 px-3 transition-colors hover:bg-white/5 ${idx % 2 === 0 ? "" : "bg-white/[0.02]"}`}>
                                <span
                                    className="w-16 text-center text-xs font-bold rounded py-0.5 shrink-0 mt-0.5 uppercase"
                                    style={{
                                        backgroundColor: `${SEVERITY_COLORS[log.severity] ?? "#6366f1"}15`,
                                        color: SEVERITY_COLORS[log.severity] ?? "#6366f1",
                                    }}
                                >
                                    {log.severity}
                                </span>
                                <span className="text-xs opacity-50 w-32 shrink-0 font-mono pt-0.5">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                                <p className="font-mono text-sm flex-1 break-all text-[var(--text-primary)]">{log.message}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
