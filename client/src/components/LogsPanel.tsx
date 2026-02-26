import { useState } from "react";
import { type Log } from "../lib/api";

interface Props {
    logs: Log[];
    isLoading: boolean;
    onFilterChange: (severity: string) => void;
}

const SEVERITY_STYLES: Record<string, { color: string; bg: string; label: string }> = {
    INFO: { color: "var(--info)", bg: "rgba(59, 130, 246, 0.1)", label: "INFO" },
    WARN: { color: "var(--warning)", bg: "rgba(245, 158, 11, 0.1)", label: "WARN" },
    ERROR: { color: "var(--error)", bg: "rgba(239, 68, 68, 0.1)", label: "ERROR" },
};

export default function LogsPanel({ logs, isLoading, onFilterChange }: Props) {
    const [activeFilter, setActiveFilter] = useState("");

    function handleFilter(severity: string) {
        const next = activeFilter === severity ? "" : severity;
        setActiveFilter(next);
        onFilterChange(next);
    }

    if (isLoading) {
        return (
            <div
                className="rounded-xl p-6"
                style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                }}
            >
                <h2
                    className="text-lg font-semibold mb-4"
                    style={{ color: "var(--text-primary)" }}
                >
                    📋 Logs
                </h2>
                <div className="animate-pulse space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div
                            key={i}
                            className="h-10 rounded-lg"
                            style={{ backgroundColor: "var(--bg-primary)" }}
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div
            className="rounded-xl p-6"
            style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border)",
            }}
        >
            <div className="flex items-center justify-between mb-4">
                <h2
                    className="text-lg font-semibold"
                    style={{ color: "var(--text-primary)" }}
                >
                    📋 Logs{" "}
                    <span
                        className="text-sm font-normal"
                        style={{ color: "var(--text-muted)" }}
                    >
                        ({logs.length})
                    </span>
                </h2>

                {/* Severity filters */}
                <div className="flex gap-2">
                    {["INFO", "WARN", "ERROR"].map((sev) => {
                        const style = SEVERITY_STYLES[sev];
                        const isActive = activeFilter === sev;
                        return (
                            <button
                                key={sev}
                                onClick={() => handleFilter(sev)}
                                className="rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer transition-all"
                                style={{
                                    backgroundColor: isActive ? style.bg : "transparent",
                                    color: isActive ? style.color : "var(--text-muted)",
                                    border: `1px solid ${isActive ? style.color : "var(--border)"}`,
                                }}
                            >
                                {style.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {logs.length === 0 ? (
                <p
                    className="text-sm py-8 text-center"
                    style={{ color: "var(--text-muted)" }}
                >
                    No logs recorded yet. Push logs via the API or enable polling.
                </p>
            ) : (
                <div className="space-y-1 max-h-[500px] overflow-y-auto font-mono text-sm">
                    {logs.map((log) => {
                        const style = SEVERITY_STYLES[log.severity] || SEVERITY_STYLES.INFO;
                        return (
                            <div
                                key={log.id}
                                className="flex items-start gap-3 rounded-lg px-3 py-2 transition-colors"
                                style={{ backgroundColor: "var(--bg-primary)" }}
                                onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                    "var(--bg-card-hover)")
                                }
                                onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                    "var(--bg-primary)")
                                }
                            >
                                <span
                                    className="text-xs whitespace-nowrap pt-0.5"
                                    style={{ color: "var(--text-muted)" }}
                                >
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                                <span
                                    className="rounded px-1.5 py-0.5 text-xs font-medium shrink-0"
                                    style={{
                                        backgroundColor: style.bg,
                                        color: style.color,
                                    }}
                                >
                                    {style.label}
                                </span>
                                <span
                                    className="break-all"
                                    style={{ color: "var(--text-primary)" }}
                                >
                                    {log.message}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
