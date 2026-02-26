import { useState, useEffect, useCallback } from "react";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from "recharts";
import { getDashboardStats, type DashboardStatsResponse } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

interface Props {
    serverId: string;
}

// Distinct chart colors for different metrics
const CHART_COLORS: Record<string, string> = {
    cpu: "#3b82f6",      // blue
    gcl: "#8b5cf6",      // purple
    credits: "#22c55e",  // green
    energy: "#f59e0b",   // amber
    power: "#ef4444",    // red
    rooms: "#06b6d4",    // cyan
};

const DEFAULT_COLOR = "#6366f1";

// Metrics that should each get their own chart (different scales)
const SEPARATE_CHART_METRICS = new Set(["gcl", "credits"]);

function formatNumber(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toFixed(1);
}

function formatTime(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function StatsCharts({ serverId }: Props) {
    const { token } = useAuth();
    const [data, setData] = useState<DashboardStatsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hours, setHours] = useState(24);

    const load = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const result = await getDashboardStats(token, serverId, hours);
            setData(result);
        } catch (err) {
            console.error("Failed to load chart data:", err);
        } finally {
            setIsLoading(false);
        }
    }, [token, serverId, hours]);

    useEffect(() => {
        load();
    }, [load]);

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
                    📈 Charts
                </h2>
                <div className="animate-pulse space-y-4">
                    {[1, 2].map((i) => (
                        <div
                            key={i}
                            className="h-48 rounded-lg"
                            style={{ backgroundColor: "var(--bg-primary)" }}
                        />
                    ))}
                </div>
            </div>
        );
    }

    if (!data || data.availableMetrics.length === 0) {
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
                    📈 Charts
                </h2>
                <p
                    className="text-sm py-8 text-center"
                    style={{ color: "var(--text-muted)" }}
                >
                    No chart data available. Push some stats to get started.
                </p>
            </div>
        );
    }

    // Split metrics into groups: shared-chart metrics and separate-chart metrics
    const sharedMetrics = data.availableMetrics.filter(
        (m) => !SEPARATE_CHART_METRICS.has(m)
    );
    const separateMetrics = data.availableMetrics.filter((m) =>
        SEPARATE_CHART_METRICS.has(m)
    );

    return (
        <div
            className="rounded-xl p-6 space-y-6"
            style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border)",
            }}
        >
            {/* Header with time range selector */}
            <div className="flex items-center justify-between">
                <h2
                    className="text-lg font-semibold"
                    style={{ color: "var(--text-primary)" }}
                >
                    📈 Charts{" "}
                    <span
                        className="text-sm font-normal"
                        style={{ color: "var(--text-muted)" }}
                    >
                        ({data.totalPoints} points)
                    </span>
                </h2>

                <div className="flex gap-1.5">
                    {[1, 6, 12, 24, 72, 168].map((h) => (
                        <button
                            key={h}
                            onClick={() => setHours(h)}
                            className="rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer transition-all"
                            style={{
                                backgroundColor:
                                    hours === h ? "var(--accent)" : "transparent",
                                color:
                                    hours === h ? "#fff" : "var(--text-muted)",
                                border: `1px solid ${hours === h ? "var(--accent)" : "var(--border)"}`,
                            }}
                        >
                            {h < 24 ? `${h}h` : `${h / 24}d`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Combined chart for same-scale metrics (e.g., cpu) */}
            {sharedMetrics.length > 0 && (
                <div>
                    <h3
                        className="text-sm font-medium mb-3"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        {sharedMetrics.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(", ")}
                    </h3>
                    <div
                        className="rounded-lg p-4"
                        style={{
                            backgroundColor: "var(--bg-primary)",
                            border: "1px solid var(--border)",
                        }}
                    >
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={data.chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis
                                    dataKey="time"
                                    tickFormatter={formatTime}
                                    stroke="var(--text-muted)"
                                    fontSize={11}
                                    tick={{ fill: "var(--text-muted)" }}
                                />
                                <YAxis
                                    tickFormatter={formatNumber}
                                    stroke="var(--text-muted)"
                                    fontSize={11}
                                    tick={{ fill: "var(--text-muted)" }}
                                    width={50}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "var(--bg-secondary)",
                                        border: "1px solid var(--border)",
                                        borderRadius: "8px",
                                        color: "var(--text-primary)",
                                        fontSize: "12px",
                                    }}
                                    labelFormatter={(label) =>
                                        new Date(label as string).toLocaleString()
                                    }
                                    formatter={(value: number | undefined) => [
                                        formatNumber(value ?? 0),
                                        undefined,
                                    ]}
                                />
                                <Legend
                                    wrapperStyle={{ fontSize: "12px", color: "var(--text-secondary)" }}
                                />
                                {sharedMetrics.map((metric) => (
                                    <Line
                                        key={metric}
                                        type="monotone"
                                        dataKey={metric}
                                        stroke={CHART_COLORS[metric] || DEFAULT_COLOR}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                        name={metric.charAt(0).toUpperCase() + metric.slice(1)}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Individual charts for metrics with very different scales */}
            {separateMetrics.map((metric) => (
                <div key={metric}>
                    <h3
                        className="text-sm font-medium mb-3"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        {metric.charAt(0).toUpperCase() + metric.slice(1)} Progress
                    </h3>
                    <div
                        className="rounded-lg p-4"
                        style={{
                            backgroundColor: "var(--bg-primary)",
                            border: "1px solid var(--border)",
                        }}
                    >
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={data.chartData}>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="var(--border)"
                                />
                                <XAxis
                                    dataKey="time"
                                    tickFormatter={formatTime}
                                    stroke="var(--text-muted)"
                                    fontSize={11}
                                    tick={{ fill: "var(--text-muted)" }}
                                />
                                <YAxis
                                    tickFormatter={formatNumber}
                                    stroke="var(--text-muted)"
                                    fontSize={11}
                                    tick={{ fill: "var(--text-muted)" }}
                                    width={60}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "var(--bg-secondary)",
                                        border: "1px solid var(--border)",
                                        borderRadius: "8px",
                                        color: "var(--text-primary)",
                                        fontSize: "12px",
                                    }}
                                    labelFormatter={(label) =>
                                        new Date(label as string).toLocaleString()
                                    }
                                    formatter={(value: number | undefined) => [
                                        formatNumber(value ?? 0),
                                        metric.charAt(0).toUpperCase() + metric.slice(1),
                                    ]}
                                />
                                <Line
                                    type="monotone"
                                    dataKey={metric}
                                    stroke={CHART_COLORS[metric] || DEFAULT_COLOR}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                    fill={`${CHART_COLORS[metric] || DEFAULT_COLOR}20`}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            ))}
        </div>
    );
}
