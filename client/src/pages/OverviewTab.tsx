import { useState, useEffect, useCallback } from "react";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";
import { getTickStats, getTickStatsLatest, type TickStatsLatest } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

interface Props {
    serverId: string;
}

function formatNumber(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toFixed(1);
}

function formatTime(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface KPI {
    label: string;
    value: string;
    sub?: string;
    color: string;
}

export default function OverviewTab({ serverId }: Props) {
    const { token } = useAuth();
    const [latest, setLatest] = useState<TickStatsLatest | null>(null);
    const [chartData, setChartData] = useState<Record<string, unknown>[]>([]);
    const [hours, setHours] = useState(6);
    const [isLoading, setIsLoading] = useState(true);

    const load = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const [latestRes, chartRes] = await Promise.all([
                getTickStatsLatest(token, serverId),
                getTickStats(token, serverId, hours, [
                    "cpu.used", "cpu.bucket", "cpu.limit",
                ]),
            ]);
            if (latestRes && "tick" in latestRes) {
                setLatest(latestRes as TickStatsLatest);
            }
            setChartData(chartRes.chartData);
        } catch (err) {
            console.error("OverviewTab load error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [token, serverId, hours]);

    useEffect(() => { load(); }, [load]);
    useAutoRefresh(load);

    const data = latest?.data ?? {};
    const kpis: KPI[] = [
        {
            label: "CPU Used",
            value: typeof data["cpu.used"] === "number" ? `${(data["cpu.used"] as number).toFixed(1)}` : "—",
            sub: typeof data["cpu.limit"] === "number" ? `/ ${data["cpu.limit"]}` : "",
            color: "#3b82f6",
        },
        {
            label: "CPU Bucket",
            value: typeof data["cpu.bucket"] === "number" ? formatNumber(data["cpu.bucket"] as number) : "—",
            sub: "/ 10,000",
            color: "#06b6d4",
        },
        {
            label: "GCL",
            value: typeof data["gcl.level"] === "number" ? String(data["gcl.level"]) : "—",
            sub: typeof data["gcl.progress"] === "number" && typeof data["gcl.progressTotal"] === "number"
                ? `${((data["gcl.progress"] as number) / (data["gcl.progressTotal"] as number) * 100).toFixed(1)}%`
                : "",
            color: "#8b5cf6",
        },
        {
            label: "Credits",
            value: typeof data["market.credits"] === "number" ? formatNumber(data["market.credits"] as number) : "—",
            color: "#22c55e",
        },
        {
            label: "Creeps",
            value: typeof data["creeps.my"] === "number" ? String(data["creeps.my"]) : "—",
            sub: typeof data["creeps.hostile"] === "number" && (data["creeps.hostile"] as number) > 0
                ? `(${data["creeps.hostile"]} hostile)`
                : "",
            color: "#f59e0b",
        },
        {
            label: "Heap",
            value: typeof data["heap.ratio"] === "number" ? `${((data["heap.ratio"] as number) * 100).toFixed(0)}%` : "—",
            color: typeof data["heap.ratio"] === "number" && (data["heap.ratio"] as number) > 0.85 ? "#ef4444" : "#6366f1",
        },
    ];

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {kpis.map((kpi) => (
                    <div
                        key={kpi.label}
                        className="rounded-xl p-4"
                        style={{
                            backgroundColor: "var(--bg-card)",
                            border: "1px solid var(--border)",
                        }}
                    >
                        <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                            {kpi.label}
                        </p>
                        <p className="text-2xl font-bold" style={{ color: kpi.color }}>
                            {isLoading ? "..." : kpi.value}
                            {kpi.sub && (
                                <span className="text-sm font-normal ml-1" style={{ color: "var(--text-muted)" }}>
                                    {kpi.sub}
                                </span>
                            )}
                        </p>
                    </div>
                ))}
            </div>

            {/* Tick info */}
            {latest && (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Tick {latest.tick} · {latest.shard} · {new Date(latest.recordedAt).toLocaleString()}
                </p>
            )}

            {/* CPU Time-Series Chart */}
            <div
                className="rounded-xl p-6"
                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        CPU Usage
                    </h3>
                    <div className="flex gap-1">
                        {[1, 6, 24, 72].map((h) => (
                            <button
                                key={h}
                                onClick={() => setHours(h)}
                                className="rounded-md px-2 py-1 text-xs font-medium cursor-pointer transition-all"
                                style={{
                                    backgroundColor: hours === h ? "var(--accent)" : "transparent",
                                    color: hours === h ? "#fff" : "var(--text-muted)",
                                    border: `1px solid ${hours === h ? "var(--accent)" : "var(--border)"}`,
                                }}
                            >
                                {h < 24 ? `${h}h` : `${h / 24}d`}
                            </button>
                        ))}
                    </div>
                </div>

                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="time" tickFormatter={formatTime} stroke="var(--text-muted)" fontSize={11} tick={{ fill: "var(--text-muted)" }} />
                            <YAxis stroke="var(--text-muted)" fontSize={11} tick={{ fill: "var(--text-muted)" }} width={50} />
                            <Tooltip
                                contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "12px" }}
                                labelFormatter={(l) => new Date(l as string).toLocaleString()}
                            />
                            <Line type="monotone" dataKey="cpu.used" stroke="#3b82f6" strokeWidth={2} dot={false} name="CPU Used" />
                            <Line type="monotone" dataKey="cpu.limit" stroke="#ef4444" strokeWidth={1} dot={false} strokeDasharray="5 5" name="CPU Limit" />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
                        {isLoading ? "Loading..." : "No tick stats yet. Poll some data first."}
                    </p>
                )}
            </div>
        </div>
    );
}
