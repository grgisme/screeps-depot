import { type Stat } from "../lib/api";

interface Props {
    stats: Stat[];
    isLoading: boolean;
}

export default function StatsPanel({ stats, isLoading }: Props) {
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
                    📊 Stats
                </h2>
                <div className="animate-pulse space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="h-16 rounded-lg"
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
            <h2
                className="text-lg font-semibold mb-4"
                style={{ color: "var(--text-primary)" }}
            >
                📊 Stats{" "}
                <span
                    className="text-sm font-normal"
                    style={{ color: "var(--text-muted)" }}
                >
                    ({stats.length})
                </span>
            </h2>

            {stats.length === 0 ? (
                <p
                    className="text-sm py-8 text-center"
                    style={{ color: "var(--text-muted)" }}
                >
                    No stats recorded yet. Push data via the API or enable polling.
                </p>
            ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {stats.map((stat) => (
                        <div
                            key={stat.id}
                            className="rounded-lg p-4 transition-colors"
                            style={{
                                backgroundColor: "var(--bg-primary)",
                                border: "1px solid var(--border)",
                            }}
                            onMouseEnter={(e) =>
                                (e.currentTarget.style.borderColor = "var(--border-focus)")
                            }
                            onMouseLeave={(e) =>
                                (e.currentTarget.style.borderColor = "var(--border)")
                            }
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span
                                    className="text-xs font-mono"
                                    style={{ color: "var(--text-muted)" }}
                                >
                                    {new Date(stat.recordedAt).toLocaleString()}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                {Object.entries(stat.data).map(([key, value]) => (
                                    <div
                                        key={key}
                                        className="rounded-md px-3 py-1.5 text-sm"
                                        style={{
                                            backgroundColor: "var(--bg-secondary)",
                                            border: "1px solid var(--border)",
                                        }}
                                    >
                                        <span style={{ color: "var(--text-muted)" }}>
                                            {key}:{" "}
                                        </span>
                                        <span
                                            className="font-mono font-medium"
                                            style={{ color: "var(--accent)" }}
                                        >
                                            {typeof value === "object"
                                                ? JSON.stringify(value)
                                                : String(value)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
