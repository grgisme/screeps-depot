import { useState, useEffect, useCallback, type FormEvent } from "react";
import { getDashboardLogs, type Log } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

interface Props {
    serverId: string;
}

const PAGE_SIZE = 50;

const SEVERITY_STYLE: Record<
    string,
    { bg: string; border: string; text: string; badge: string; badgeBg: string }
> = {
    INFO: {
        bg: "transparent",
        border: "var(--border)",
        text: "var(--text-primary)",
        badge: "var(--info)",
        badgeBg: "rgba(59, 130, 246, 0.15)",
    },
    WARN: {
        bg: "rgba(245, 158, 11, 0.04)",
        border: "rgba(245, 158, 11, 0.2)",
        text: "var(--text-primary)",
        badge: "var(--warning)",
        badgeBg: "rgba(245, 158, 11, 0.15)",
    },
    ERROR: {
        bg: "rgba(239, 68, 68, 0.04)",
        border: "rgba(239, 68, 68, 0.2)",
        text: "var(--text-primary)",
        badge: "var(--error)",
        badgeBg: "rgba(239, 68, 68, 0.15)",
    },
};

export default function LogViewer({ serverId }: Props) {
    const { token } = useAuth();
    const [logs, setLogs] = useState<Log[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [severity, setSeverity] = useState("");
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");

    const load = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const result = await getDashboardLogs(token, serverId, {
                limit: PAGE_SIZE,
                offset,
                severity: severity || undefined,
                search: search || undefined,
            });
            setLogs(result.logs);
            setTotal(result.total);
        } catch (err) {
            console.error("Failed to load logs:", err);
        } finally {
            setIsLoading(false);
        }
    }, [token, serverId, offset, severity, search]);

    // Reset pagination when filters or server change
    useEffect(() => {
        setOffset(0);
    }, [serverId, severity, search]);

    useEffect(() => {
        load();
    }, [load]);

    function handleSearch(e: FormEvent) {
        e.preventDefault();
        setSearch(searchInput);
    }

    const totalPages = Math.ceil(total / PAGE_SIZE);
    const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

    return (
        <div
            className="rounded-xl p-6"
            style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border)",
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2
                    className="text-lg font-semibold"
                    style={{ color: "var(--text-primary)" }}
                >
                    📋 Log Viewer{" "}
                    <span
                        className="text-sm font-normal"
                        style={{ color: "var(--text-muted)" }}
                    >
                        ({total} total)
                    </span>
                </h2>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
                {/* Search input */}
                <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
                    <input
                        id="log-search"
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search logs..."
                        className="flex-1 rounded-lg px-3 py-2 text-sm outline-none transition-all"
                        style={{
                            backgroundColor: "var(--bg-input)",
                            border: "1px solid var(--border)",
                            color: "var(--text-primary)",
                        }}
                        onFocus={(e) =>
                            (e.target.style.borderColor = "var(--border-focus)")
                        }
                        onBlur={(e) =>
                            (e.target.style.borderColor = "var(--border)")
                        }
                    />
                    <button
                        type="submit"
                        className="rounded-lg px-3 py-2 text-sm font-medium cursor-pointer transition-all"
                        style={{
                            backgroundColor: "var(--accent)",
                            color: "#fff",
                            border: "none",
                        }}
                    >
                        Search
                    </button>
                    {search && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchInput("");
                                setSearch("");
                            }}
                            className="rounded-lg px-3 py-2 text-sm cursor-pointer transition-all"
                            style={{
                                backgroundColor: "transparent",
                                border: "1px solid var(--border)",
                                color: "var(--text-muted)",
                            }}
                        >
                            Clear
                        </button>
                    )}
                </form>

                {/* Severity filter */}
                <select
                    id="log-severity-filter"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="rounded-lg px-3 py-2 text-sm outline-none cursor-pointer"
                    style={{
                        backgroundColor: "var(--bg-input)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                    }}
                >
                    <option value="">All Severities</option>
                    <option value="INFO">INFO</option>
                    <option value="WARN">WARN</option>
                    <option value="ERROR">ERROR</option>
                </select>
            </div>

            {/* Log table */}
            {isLoading ? (
                <div className="animate-pulse space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div
                            key={i}
                            className="h-10 rounded-lg"
                            style={{ backgroundColor: "var(--bg-primary)" }}
                        />
                    ))}
                </div>
            ) : logs.length === 0 ? (
                <p
                    className="text-sm py-10 text-center"
                    style={{ color: "var(--text-muted)" }}
                >
                    {search || severity
                        ? "No logs match your filters."
                        : "No logs recorded yet."}
                </p>
            ) : (
                <>
                    {/* Table header */}
                    <div
                        className="grid gap-3 px-3 py-2 rounded-t-lg text-xs font-semibold uppercase tracking-wider"
                        style={{
                            gridTemplateColumns: "140px 70px 1fr",
                            backgroundColor: "var(--bg-primary)",
                            borderBottom: "1px solid var(--border)",
                            color: "var(--text-muted)",
                        }}
                    >
                        <span>Timestamp</span>
                        <span>Severity</span>
                        <span>Message</span>
                    </div>

                    {/* Log rows */}
                    <div
                        className="max-h-[500px] overflow-y-auto"
                        style={{ scrollbarGutter: "stable" }}
                    >
                        {logs.map((log) => {
                            const style =
                                SEVERITY_STYLE[log.severity] || SEVERITY_STYLE.INFO;
                            return (
                                <div
                                    key={log.id}
                                    className="grid gap-3 px-3 py-2.5 text-sm transition-colors"
                                    style={{
                                        gridTemplateColumns: "140px 70px 1fr",
                                        backgroundColor: style.bg,
                                        borderBottom: `1px solid ${style.border}`,
                                    }}
                                    onMouseEnter={(e) =>
                                    (e.currentTarget.style.backgroundColor =
                                        "var(--bg-card-hover)")
                                    }
                                    onMouseLeave={(e) =>
                                        (e.currentTarget.style.backgroundColor = style.bg)
                                    }
                                >
                                    <span
                                        className="font-mono text-xs pt-0.5 whitespace-nowrap"
                                        style={{ color: "var(--text-muted)" }}
                                    >
                                        {new Date(log.timestamp).toLocaleString([], {
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            second: "2-digit",
                                        })}
                                    </span>
                                    <span>
                                        <span
                                            className="inline-block rounded px-1.5 py-0.5 text-xs font-bold"
                                            style={{
                                                backgroundColor: style.badgeBg,
                                                color: style.badge,
                                            }}
                                        >
                                            {log.severity}
                                        </span>
                                    </span>
                                    <span
                                        className="font-mono text-xs break-all"
                                        style={{ color: style.text }}
                                    >
                                        {log.message}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Pagination */}
            {total > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-4 pt-4"
                    style={{ borderTop: "1px solid var(--border)" }}
                >
                    <span
                        className="text-sm"
                        style={{ color: "var(--text-muted)" }}
                    >
                        Page {currentPage} of {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <button
                            id="log-prev"
                            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                            disabled={offset === 0}
                            className="rounded-lg px-3 py-1.5 text-sm cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            style={{
                                backgroundColor: "transparent",
                                border: "1px solid var(--border)",
                                color: "var(--text-secondary)",
                            }}
                        >
                            ← Previous
                        </button>
                        <button
                            id="log-next"
                            onClick={() => setOffset(offset + PAGE_SIZE)}
                            disabled={offset + PAGE_SIZE >= total}
                            className="rounded-lg px-3 py-1.5 text-sm cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            style={{
                                backgroundColor: "transparent",
                                border: "1px solid var(--border)",
                                color: "var(--text-secondary)",
                            }}
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
