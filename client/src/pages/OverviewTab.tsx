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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {kpis.map((kpi) => (
                    <div
                        key={kpi.label}
                        className="glass-panel-interactive rounded-2xl p-5 flex flex-col"
                    >
                        <p className="text-xs font-semibold mb-2 uppercase tracking-wider text-[var(--text-muted)]">
                            {kpi.label}
                        </p>
                        <p className="text-3xl font-bold tracking-tight mt-auto" style={{ color: kpi.color, textShadow: `0 0 20px ${kpi.color}40` }}>
                            {isLoading ? "..." : kpi.value}
                            {kpi.sub && (
                                <span className="text-sm font-medium ml-1.5 opacity-70">
                                    {kpi.sub}
                                </span>
                            )}
                        </p>
                    </div>
                ))}
            </div>

            {/* Tick info */}
            {latest && (
                <div className="flex items-center gap-2 px-1">
                    <div className="w-2 h-2 rounded-full bg-[var(--success)] shadow-[0_0_8px_var(--success)] animate-pulse"></div>
                    <p className="text-xs text-[var(--text-muted)] font-medium tracking-wide">
                        Tick <span className="text-[var(--text-primary)]">{latest.tick}</span> · Shard <span className="text-[var(--text-primary)]">{latest.shard}</span> · {new Date(latest.recordedAt).toLocaleString()}
                    </p>
                </div>
            )}

            {/* CPU Time-Series Chart */}
            <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
                {/* Subtle top border highlight */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-30"></div>

                <div className="flex items-center justify-between mb-6 relative z-10">
                    <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
                        <span className="text-[var(--accent)]">⚡</span> CPU Usage History
                    </h3>
                    <div className="flex gap-1 p-1 bg-[var(--bg-input)] rounded-xl border border-[var(--border-light)] shadow-inner shadow-[var(--bg-base)]">
                        {[1, 6, 24, 72].map((h) => (
                            <button
                                key={h}
                                onClick={() => setHours(h)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all ${hours === h
                                        ? "bg-[var(--accent)] text-white shadow-md shadow-[var(--accent-glow)]"
                                        : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                                    }`}
                            >
                                {h < 24 ? `${h}h` : `${h / 24}d`}
                            </button>
                        ))}
                    </div>
                </div>

                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                            <XAxis dataKey="time" tickFormatter={formatTime} stroke="var(--text-muted)" fontSize={11} tick={{ fill: "var(--text-muted)", opacity: 0.8 }} tickLine={false} axisLine={false} dy={10} />
                            <YAxis stroke="var(--text-muted)" fontSize={11} tick={{ fill: "var(--text-muted)", opacity: 0.8 }} width={60} tickLine={false} axisLine={false} dx={-10} />
                            <Tooltip
                                contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-light)", borderRadius: "12px", color: "var(--text-primary)", fontSize: "12px", backdropFilter: "blur(12px)", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)" }}
                                labelFormatter={(l) => new Date(l as string).toLocaleString()}
                                itemStyle={{ fontWeight: 500 }}
                            />
                            <Line type="monotone" dataKey="cpu.used" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0, fill: "#3b82f6", style: { filter: "drop-shadow(0px 0px 5px rgba(59,130,246,0.8))" } }} name="CPU Used" />
                            <Line type="monotone" dataKey="cpu.limit" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="6 4" name="CPU Limit" opacity={0.8} />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="text-sm text-center py-12 text-[var(--text-muted)]">
                        {isLoading ? "Loading data from Depot..." : "No tick stats yet. Poll some data first."}
                    </p>
                )}
            </div>
        </div>
    );
}
