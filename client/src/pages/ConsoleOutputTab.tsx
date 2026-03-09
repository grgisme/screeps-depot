import { useState, useEffect, useCallback } from "react";
import {
    getConsoleOutputEntries,
    getConsoleOutputSummary,
    type ConsoleOutputResponse,
    type ConsoleOutputSummary,
} from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useAutoRefresh } from "../hooks/useAutoRefresh";

interface Props {
    serverId: string;
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    T: { bg: "#6366f120", text: "#6366f1", label: "TRACE" },
    D: { bg: "#8b5cf620", text: "#8b5cf6", label: "DEBUG" },
    I: { bg: "#3b82f620", text: "#3b82f6", label: "INFO" },
    W: { bg: "#f59e0b20", text: "#f59e0b", label: "WARN" },
    E: { bg: "#ef444420", text: "#ef4444", label: "ERROR" },
};

export default function ConsoleOutputTab({ serverId }: Props) {
    const { token } = useAuth();
    const [data, setData] = useState<ConsoleOutputResponse | null>(null);
    const [summary, setSummary] = useState<ConsoleOutputSummary | null>(null);
    const [severity, setSeverity] = useState<string>("");
    const [page, setPage] = useState(1);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const load = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const [entries, sum] = await Promise.all([
                getConsoleOutputEntries(token, serverId, { severity: severity || undefined, page, limit: 100 }),
                getConsoleOutputSummary(token, serverId),
            ]);
            setData(entries);
            setSummary(sum);
        } catch (err) {
            console.error("ConsoleOutputTab error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [token, serverId, severity, page]);

    useEffect(() => { load(); }, [load]);
    useAutoRefresh(load);

    return (
        <div className="space-y-6">
            {/* Summary cards */}
            {summary && (
                <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
                    {(["T", "D", "I", "W", "E"] as const).map((s) => {
                        const style = SEVERITY_STYLES[s];
                        return (
                            <div key={`hour-${s}`} className="glass-panel-interactive rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden group">
                                <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-300" style={{ backgroundColor: style.text }}></div>
                                <p className="text-[10px] mb-1 uppercase tracking-wider font-semibold z-10" style={{ color: "var(--text-muted)" }}>{style.label} (1h)</p>
                                <p className="text-xl font-bold tracking-tight text-glow z-10" style={{ color: style.text, textShadow: `0 0 10px ${style.text}40` }}>{summary.lastHour[s] ?? 0}</p>
                            </div>
                        );
                    })}
                    {(["T", "D", "I", "W", "E"] as const).map((s) => {
                        const style = SEVERITY_STYLES[s];
                        return (
                            <div key={`day-${s}`} className="glass-panel-interactive rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden group">
                                <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-300" style={{ backgroundColor: style.text }}></div>
                                <p className="text-[10px] mb-1 uppercase tracking-wider font-semibold z-10" style={{ color: "var(--text-muted)" }}>{style.label} (24h)</p>
                                <p className="text-xl font-bold tracking-tight text-glow z-10" style={{ color: style.text, textShadow: `0 0 10px ${style.text}40` }}>{summary.lastDay[s] ?? 0}</p>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Filters */}
            <div className="glass-panel p-3 rounded-xl flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] ml-1">Filter:</span>
                <div className="flex flex-wrap gap-1 bg-[var(--bg-input)] p-1 rounded-lg border border-[var(--border-light)] shadow-inner">
                    {["", "T", "D", "I", "W", "E"].map((s) => {
                        const isActive = severity === s;
                        const style = s ? SEVERITY_STYLES[s] : { text: "var(--accent)" };
                        return (
                            <button key={s} onClick={() => { setSeverity(s); setPage(1); }}
                                className={`rounded-md px-3 py-1.5 text-xs font-bold cursor-pointer transition-all ${isActive
                                        ? `text-white shadow-md`
                                        : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                                    }`}
                                style={isActive ? { backgroundColor: style.text, boxShadow: `0 4px 12px ${style.text}40` } : {}}
                            >
                                {s ? SEVERITY_STYLES[s].label : "ALL"}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Log entries */}
            <div className="glass-panel rounded-2xl overflow-hidden flex flex-col relative border border-[var(--border-light)]">
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-30"></div>

                {isLoading ? (
                    <div className="p-12 text-center text-[var(--text-muted)] animate-pulse text-sm">Loading console output...</div>
                ) : !data || data.entries.length === 0 ? (
                    <div className="p-12 text-center text-[var(--text-muted)] text-sm">
                        No console output yet. Make sure your bot writes to segment 96 with a LogRelay circular buffer.
                    </div>
                ) : (
                    <div className="divide-y divide-[var(--border-light)]">
                        {data.entries.map((entry) => {
                            const style = SEVERITY_STYLES[entry.severity] ?? SEVERITY_STYLES.I;
                            const isExpanded = expandedId === entry.id;
                            return (
                                <div
                                    key={entry.id}
                                    className="cursor-pointer transition-colors hover:bg-[var(--bg-card-hover)]/30 group"
                                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                                >
                                    <div className="flex items-start gap-4 p-3">
                                        <span className="text-[10px] font-black tracking-wider px-2 py-1 rounded-md mt-0.5 shrink-0 uppercase shadow-sm border transition-colors"
                                            style={{ backgroundColor: `${style.text}15`, color: style.text, borderColor: `${style.text}30` }}>
                                            {style.label}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <span className="text-[10px] sm:text-xs font-mono px-2 py-0.5 rounded shadow-sm border border-[var(--border-light)]" style={{ backgroundColor: "#030712", color: "var(--accent)" }}>{entry.context}</span>
                                                {entry.room && <span className="text-[10px] sm:text-xs font-mono font-medium" style={{ color: "var(--text-muted)" }}>🏠 {entry.room}</span>}
                                                <div className="flex-1"></div>
                                                <span className="text-[10px] sm:text-xs font-mono shrink-0 bg-[#030712]/50 px-2 py-1 rounded border border-[var(--border-light)] flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                                                    <span>{(() => { const d = new Date(entry.recordedAt); const mm = String(d.getMonth() + 1).padStart(2, "0"); const dd = String(d.getDate()).padStart(2, "0"); let h = d.getHours(); const ampm = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return `${mm}/${dd} ${h}:${String(d.getMinutes()).padStart(2, "0")} ${ampm}`; })()}</span>
                                                    <span className="opacity-50">•</span>
                                                    <span className="text-[var(--text-secondary)]">T{entry.tick}</span>
                                                </span>
                                            </div>
                                            <p className={`text-sm mt-1 break-words leading-relaxed text-[var(--text-primary)] group-hover:text-white transition-colors ${isExpanded ? "" : "truncate"}`}>{entry.message}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {data && data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-4">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="glass-panel-interactive px-4 py-2 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:text-[var(--accent)] transition-all"
                    >
                        ← Previous
                    </button>
                    <div className="glass-panel px-4 py-2 rounded-lg text-xs font-medium text-[var(--text-muted)] border border-[var(--border-light)] shadow-inner">
                        Page <span className="text-[var(--text-primary)] font-bold">{page}</span> of <span className="text-[var(--text-primary)] font-bold">{data.pagination.totalPages}</span> <span className="opacity-70">({data.pagination.total} total)</span>
                    </div>
                    <button
                        onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                        disabled={page >= data.pagination.totalPages}
                        className="glass-panel-interactive px-4 py-2 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:text-[var(--accent)] transition-all"
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
}
