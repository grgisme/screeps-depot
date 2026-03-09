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
            {/* Filters */}
            <div className="glass-panel p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] ml-1">Severity:</span>
                    <div className="flex gap-1 bg-[var(--bg-input)] p-1 rounded-lg border border-[var(--border-light)] shadow-inner">
                        {["", "INFO", "WARN", "ERROR"].map((s) => (
                            <button key={s} onClick={() => setSeverity(s)}
                                className={`rounded-md px-3 py-1.5 text-xs font-bold cursor-pointer transition-all ${severity === s
                                    ? (s ? `bg-[${SEVERITY_COLORS[s]}] text-white shadow-md shadow-[${SEVERITY_COLORS[s]}40]` : "bg-[var(--accent)] text-white shadow-md shadow-[var(--accent-glow)]")
                                    : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                                    }`}
                                style={severity === s && s ? { backgroundColor: SEVERITY_COLORS[s], boxShadow: `0 4px 12px ${SEVERITY_COLORS[s]}40` } : {}}
                            >
                                {s || "ALL"}
                            </button>
                        ))}
                    </div>
                </div>
                <button onClick={load} className="glass-panel-interactive px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--text-primary)] hover:text-[var(--accent)] flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>
            </div>

            {/* Log entries */}
            <div className="glass-panel rounded-2xl overflow-hidden flex flex-col relative border border-[var(--border-light)]">
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-30"></div>

                {isLoading ? (
                    <div className="p-12 text-center text-[var(--text-muted)] animate-pulse text-sm">Loading telemetry...</div>
                ) : logs.length === 0 ? (
                    <div className="p-12 text-center text-[var(--text-muted)] text-sm">No system logs found for this filter.</div>
                ) : (
                    <div className="divide-y divide-[var(--border-light)]">
                        {logs.map((log) => (
                            <div key={log.id} className="flex items-start gap-5 p-5 hover:bg-[var(--bg-card-hover)]/30 transition-colors group">
                                <span className="text-[10px] font-black tracking-wider px-2 py-1 rounded-md mt-0.5 shrink-0 uppercase shadow-sm border"
                                    style={{
                                        backgroundColor: `${SEVERITY_COLORS[log.severity] ?? "#6366f1"}15`,
                                        color: SEVERITY_COLORS[log.severity] ?? "#6366f1",
                                        borderColor: `${SEVERITY_COLORS[log.severity] ?? "#6366f1"}30`
                                    }}>
                                    {log.severity}
                                </span>
                                <p className="text-sm flex-1 break-words leading-relaxed text-[var(--text-primary)] group-hover:text-white transition-colors">{log.message}</p>
                                <span className="text-xs shrink-0 font-mono text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors bg-[#030712]/50 px-2 py-1 rounded border border-[var(--border-light)]">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
