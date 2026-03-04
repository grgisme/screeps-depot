import { useState, useEffect, useCallback } from "react";
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

    return (
        <div className="space-y-4">
            {/* Summary cards */}
            {summary && (
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {(["I", "W", "E"] as const).map((s) => {
                        const style = SEVERITY_STYLES[s];
                        return (
                            <div key={`hour-${s}`} className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                                <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{style.label} (1h)</p>
                                <p className="text-2xl font-bold" style={{ color: style.text }}>{summary.lastHour[s] ?? 0}</p>
                            </div>
                        );
                    })}
                    {(["I", "W", "E"] as const).map((s) => {
                        const style = SEVERITY_STYLES[s];
                        return (
                            <div key={`day-${s}`} className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                                <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{style.label} (24h)</p>
                                <p className="text-2xl font-bold" style={{ color: style.text }}>{summary.lastDay[s] ?? 0}</p>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-2">
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Filter:</span>
                {["", "I", "W", "E"].map((s) => (
                    <button key={s} onClick={() => { setSeverity(s); setPage(1); }}
                        className="rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer transition-all"
                        style={{
                            backgroundColor: severity === s ? (s ? SEVERITY_STYLES[s].text : "var(--accent)") : "transparent",
                            color: severity === s ? "#fff" : "var(--text-muted)",
                            border: `1px solid ${severity === s ? (s ? SEVERITY_STYLES[s].text : "var(--accent)") : "var(--border)"}`,
                        }}>
                        {s ? SEVERITY_STYLES[s].label : "ALL"}
                    </button>
                ))}
            </div>

            {/* Event list */}
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                {isLoading ? (
                    <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>Loading...</p>
                ) : !data || data.entries.length === 0 ? (
                    <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
                        No flight recorder entries. Make sure your bot uses FlightRecorder and segments 98/99 are active.
                    </p>
                ) : (
                    <div>
                        {data.entries.map((entry) => {
                            const style = SEVERITY_STYLES[entry.severity] ?? SEVERITY_STYLES.I;
                            const isExpanded = expandedId === entry.id;
                            return (
                                <div
                                    key={entry.id}
                                    className="cursor-pointer transition-colors"
                                    style={{ borderBottom: "1px solid var(--border)" }}
                                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                                >
                                    <div className="flex items-start gap-3 px-4 py-3">
                                        <span className="text-xs font-bold px-1.5 py-0.5 rounded mt-0.5 shrink-0"
                                            style={{ backgroundColor: style.bg, color: style.text }}>
                                            {style.label}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-primary)", color: "var(--accent)" }}>{entry.context}</span>
                                                {entry.room && <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>🏠 {entry.room}</span>}
                                                <span className="text-xs font-mono ml-auto shrink-0" style={{ color: "var(--text-muted)" }}>
                                                    {(() => { const d = new Date(entry.recordedAt); const mm = String(d.getMonth() + 1).padStart(2, "0"); const dd = String(d.getDate()).padStart(2, "0"); let h = d.getHours(); const ampm = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return `${mm}/${dd} ${h}:${String(d.getMinutes()).padStart(2, "0")} ${ampm}`; })()}
                                                    {" · "}T{entry.tick}
                                                </span>
                                            </div>
                                            <p className="text-sm mt-1 break-words" style={{ color: "var(--text-primary)" }}>{entry.message}</p>
                                        </div>
                                    </div>
                                    {isExpanded && entry.stackTrace && (
                                        <pre className="text-xs px-4 pb-3 font-mono overflow-x-auto whitespace-pre-wrap" style={{ color: "#ef4444" }}>
                                            {entry.stackTrace}
                                        </pre>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {data && data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="rounded-md px-3 py-1 text-xs cursor-pointer disabled:opacity-30"
                        style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                        ← Prev
                    </button>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Page {page} of {data.pagination.totalPages} ({data.pagination.total} total)
                    </span>
                    <button
                        onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                        disabled={page >= data.pagination.totalPages}
                        className="rounded-md px-3 py-1 text-xs cursor-pointer disabled:opacity-30"
                        style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
}
