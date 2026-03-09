import { useState, useEffect, useCallback } from "react";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import {
    getFlightRecorderEntries,
    getFlightRecorderSummary,
    type FlightRecorderResponse,
    type FlightRecorderSummary,
} from "../lib/api";
import { useAuth } from "../hooks/useAuth";

interface Props {
    serverId: string;
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    I: { bg: "#3b82f620", text: "#3b82f6", label: "INFO" },
    W: { bg: "#f59e0b20", text: "#f59e0b", label: "WARN" },
    E: { bg: "#ef444420", text: "#ef4444", label: "ERROR" },
};

export default function FlightRecorderTab({ serverId }: Props) {
    const { token } = useAuth();
    const [data, setData] = useState<FlightRecorderResponse | null>(null);
    const [summary, setSummary] = useState<FlightRecorderSummary | null>(null);
    const [severity, setSeverity] = useState<string>("");
    const [page, setPage] = useState(1);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const load = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const [entries, sum] = await Promise.all([
                getFlightRecorderEntries(token, serverId, { severity: severity || undefined, page, limit: 50 }),
                getFlightRecorderSummary(token, serverId),
            ]);
            setData(entries);
            setSummary(sum);
        } catch (err) {
            console.error("FlightRecorderTab error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [token, serverId, severity, page]);

    useEffect(() => { load(); }, [load]);
    useAutoRefresh(load);

    return (
        <div className="space-y-6">
            {/* Summary cards — compact 3-col grid */}
            {summary && (
                <div className="grid grid-cols-3 gap-2">
                    {(["I", "W", "E"] as const).map((s) => {
                        const style = SEVERITY_STYLES[s];
                        return (
                            <div key={`combined-${s}`} className="glass-panel rounded-xl p-3 flex items-center gap-4 relative overflow-hidden group">
                                <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-300" style={{ backgroundColor: style.text }}></div>
                                <div className="z-10 flex-1 text-center">
                                    <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">{style.label} 1h</p>
                                    <p className="text-xl font-outfit font-bold" style={{ color: style.text }}>{summary.lastHour[s] ?? 0}</p>
                                </div>
                                <div className="z-10 w-px h-8 bg-[var(--border-light)]" />
                                <div className="z-10 flex-1 text-center">
                                    <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">{style.label} 24h</p>
                                    <p className="text-xl font-outfit font-bold" style={{ color: style.text }}>{summary.lastDay[s] ?? 0}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Filter bar — toggle pills */}
            <div className="flex gap-2">
                {["", "I", "W", "E"].map((s) => {
                    const isActive = severity === s;
                    const style = s ? SEVERITY_STYLES[s] : { text: "var(--accent)" };
                    return (
                        <button key={s} onClick={() => { setSeverity(s); setPage(1); }}
                            className={`px-4 py-1.5 rounded-full border text-sm cursor-pointer transition-all font-medium ${isActive
                                ? "text-white border-transparent shadow-md"
                                : "border-[var(--border-light)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5"
                                }`}
                            style={isActive ? { backgroundColor: style.text, boxShadow: `0 4px 12px ${style.text}40` } : {}}
                        >
                            {s ? SEVERITY_STYLES[s].label : "ALL"}
                        </button>
                    );
                })}
            </div>

            {/* Event list — dense continuous list */}
            <div className="glass-panel rounded-2xl overflow-hidden relative border border-[var(--border-light)]">
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-30"></div>

                {isLoading ? (
                    <div className="p-12 text-center text-[var(--text-muted)] animate-pulse text-sm">Loading flight recorder logs...</div>
                ) : !data || data.entries.length === 0 ? (
                    <div className="p-12 text-center text-[var(--text-muted)] text-sm">
                        No flight recorder entries. Make sure your bot uses FlightRecorder and segments 98/99 are active.
                    </div>
                ) : (
                    <div>
                        {data.entries.map((entry, idx) => {
                            const style = SEVERITY_STYLES[entry.severity] ?? SEVERITY_STYLES.I;
                            const isExpanded = expandedId === entry.id;
                            return (
                                <div
                                    key={entry.id}
                                    className={`cursor-pointer transition-colors hover:bg-white/5 ${idx % 2 === 0 ? "" : "bg-white/[0.02]"}`}
                                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                                >
                                    <div className="flex items-start gap-4 py-2 px-3">
                                        <span
                                            className="w-16 text-center text-xs font-bold rounded py-0.5 shrink-0 mt-0.5 uppercase"
                                            style={{ backgroundColor: `${style.text}15`, color: style.text }}
                                        >
                                            {style.label}
                                        </span>
                                        <span className="text-xs opacity-50 w-32 shrink-0 font-mono pt-0.5">
                                            {(() => { const d = new Date(entry.recordedAt); const mm = String(d.getMonth() + 1).padStart(2, "0"); const dd = String(d.getDate()).padStart(2, "0"); let h = d.getHours(); const ampm = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return `${mm}/${dd} ${h}:${String(d.getMinutes()).padStart(2, "0")} ${ampm}`; })()}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[var(--border-light)] bg-[var(--bg-primary)]" style={{ color: "var(--accent)" }}>{entry.context}</span>
                                                {entry.room && <span className="text-[10px] font-mono text-[var(--text-muted)]">🏠 {entry.room}</span>}
                                                <span className="text-[10px] font-mono text-[var(--text-muted)] ml-auto shrink-0">T{entry.tick}</span>
                                            </div>
                                            <p className="font-mono text-sm break-all text-[var(--text-primary)]">{entry.message}</p>
                                        </div>
                                    </div>
                                    {isExpanded && entry.stackTrace && (
                                        <div className="px-3 pb-3 pt-1">
                                            <pre className="text-xs p-3 rounded-md font-mono overflow-x-auto whitespace-pre-wrap bg-black/30 text-red-400 border border-red-500/20 mt-2">
                                                {entry.stackTrace}
                                            </pre>
                                        </div>
                                    )}
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
