import { useState, useEffect, useCallback } from "react";
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from "recharts";
import { getTickStatsEnergy, type EnergyResponse } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useAutoRefresh } from "../hooks/useAutoRefresh";

interface Props {
    serverId: string;
}

// Curated palette — each room gets a distinct hue
const ROOM_COLORS = [
    "#f59e0b", // amber
    "#22c55e", // green
    "#3b82f6", // blue
    "#8b5cf6", // purple
    "#ef4444", // red
    "#06b6d4", // cyan
    "#ec4899", // pink
    "#14b8a6", // teal
    "#f97316", // orange
    "#6366f1", // indigo
    "#84cc16", // lime
    "#a855f7", // violet
];

const EMPIRE_COLOR = "#fbbf24"; // gold

function formatEnergy(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return String(Math.round(value));
}

function formatTime(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function EnergyTab({ serverId }: Props) {
    const { token } = useAuth();
    const [data, setData] = useState<EnergyResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hours, setHours] = useState(24);

    const load = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const result = await getTickStatsEnergy(token, serverId, hours);
            setData(result);
        } catch (err) {
            console.error("EnergyTab error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [token, serverId, hours]);

    useEffect(() => {
        load();
    }, [load]);
    useAutoRefresh(load);

    // ── Latest empire energy for the KPI card ──
    const latestPoint = data?.chartData?.length
        ? data.chartData[data.chartData.length - 1]
        : null;
    const latestEmpire =
        latestPoint && typeof latestPoint["empire"] === "number"
            ? (latestPoint["empire"] as number)
            : null;

    // ── Compute per-room latest values for summary cards ──
    const roomSummaries =
        data?.rooms.map((room, i) => ({
            room,
            color: ROOM_COLORS[i % ROOM_COLORS.length],
            value:
                latestPoint && typeof latestPoint[room] === "number"
                    ? (latestPoint[room] as number)
                    : 0,
        })) ?? [];

    const TIME_RANGES = [
        { h: 1, label: "1h" },
        { h: 6, label: "6h" },
        { h: 24, label: "24h" },
        { h: 72, label: "3d" },
        { h: 168, label: "7d" },
    ];

    // ── Shared tooltip style ──
    const tooltipStyle = {
        backgroundColor: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        color: "var(--text-primary)",
        fontSize: "12px",
    };

    return (
        <div className="space-y-8">
            {/* KPI Cards Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                {/* Empire total */}
                <div className="glass-panel-interactive rounded-2xl p-6 flex flex-col col-span-2 lg:col-span-1">
                    <p className="text-xs font-semibold mb-2 uppercase tracking-wider text-[var(--text-muted)]">
                        🏛️ Empire Total
                    </p>
                    <p className="text-3xl font-bold tracking-tight mt-auto text-glow" style={{ color: EMPIRE_COLOR, textShadow: `0 0 20px ${EMPIRE_COLOR}40` }}>
                        {isLoading ? "..." : latestEmpire !== null ? formatEnergy(latestEmpire) : "—"}
                    </p>
                </div>

                {/* Per-room cards */}
                {roomSummaries.map((r) => (
                    <div key={r.room} className="glass-panel-interactive rounded-2xl p-6 flex flex-col">
                        <p className="text-xs font-semibold mb-2 uppercase tracking-wider text-[var(--text-muted)]">
                            🏠 {r.room}
                        </p>
                        <p className="text-2xl font-bold tracking-tight mt-auto text-glow" style={{ color: r.color, textShadow: `0 0 20px ${r.color}40` }}>
                            {isLoading ? "..." : formatEnergy(r.value)}
                        </p>
                    </div>
                ))}
            </div>

            {/* Empire Energy Over Time */}
            <div className="glass-panel rounded-2xl p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-30"></div>
                <div className="flex items-center justify-between mb-6 relative z-10">
                    <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
                        <span className="text-[var(--warning)]">🏛️</span> Empire Energy Over Time
                        {data && (
                            <span className="font-medium text-xs ml-2 opacity-60 text-[var(--text-muted)]">
                                ({data.totalPoints} points)
                            </span>
                        )}
                    </h3>
                    <div className="flex gap-1 p-1 bg-[var(--bg-input)] rounded-xl border border-[var(--border-light)] shadow-inner shadow-[var(--bg-base)]">
                        {TIME_RANGES.map(({ h, label }) => (
                            <button
                                key={h}
                                onClick={() => setHours(h)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all ${hours === h
                                    ? "bg-[var(--accent)] text-white shadow-md shadow-[var(--accent-glow)]"
                                    : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {isLoading ? (
                    <div className="h-64 rounded-xl animate-pulse bg-[var(--bg-primary)]/50 border border-[var(--border-light)]" />
                ) : !data || data.chartData.length === 0 ? (
                    <p className="text-sm text-center py-12 text-[var(--text-muted)]">
                        No energy data available yet. Make sure your bot exports rooms.*.energyAvailable stats.
                    </p>
                ) : (
                    <div className="rounded-xl p-4 bg-[#030712]/40 border border-[var(--border-light)] shadow-inner">
                        <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={data.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    {data.rooms.map((room, i) => (
                                        <linearGradient key={room} id={`grad-${room}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={ROOM_COLORS[i % ROOM_COLORS.length]} stopOpacity={0.5} />
                                            <stop offset="95%" stopColor={ROOM_COLORS[i % ROOM_COLORS.length]} stopOpacity={0.05} />
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                                <XAxis dataKey="time" tickFormatter={formatTime} stroke="var(--text-muted)" fontSize={11} tick={{ fill: "var(--text-muted)", opacity: 0.8 }} tickLine={false} axisLine={false} dy={10} />
                                <YAxis tickFormatter={formatEnergy} stroke="var(--text-muted)" fontSize={11} tick={{ fill: "var(--text-muted)", opacity: 0.8 }} width={55} tickLine={false} axisLine={false} dx={-10} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-light)", borderRadius: "12px", color: "var(--text-primary)", fontSize: "12px", backdropFilter: "blur(12px)", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)" }}
                                    labelFormatter={(label) => new Date(label as string).toLocaleString()}
                                    formatter={(value: number | undefined, name?: string) => [formatEnergy(value ?? 0), name === "empire" ? "Empire Total" : (name ?? "")]}
                                    itemStyle={{ fontWeight: 500 }}
                                />
                                <Legend wrapperStyle={{ fontSize: "12px", color: "var(--text-secondary)", paddingTop: "10px" }} formatter={(value: string) => value === "empire" ? "Empire Total" : value} iconType="circle" />
                                {data.rooms.map((room, i) => (
                                    <Area key={room} type="monotone" dataKey={room} stackId="energy" stroke={ROOM_COLORS[i % ROOM_COLORS.length]} fill={`url(#grad-${room})`} strokeWidth={2} name={room} activeDot={{ r: 5, strokeWidth: 0 }} />
                                ))}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Per-Room Breakdown */}
            {data && data.rooms.length > 0 && data.chartData.length > 0 && (
                <div className="glass-panel rounded-2xl p-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-30"></div>
                    <h3 className="text-base font-semibold mb-6 text-[var(--text-primary)] flex items-center gap-2 relative z-10">
                        <span className="text-[var(--accent)]">🏠</span> Per-Room Energy Breakdown
                    </h3>
                    <div className="rounded-xl p-4 bg-[#030712]/40 border border-[var(--border-light)] shadow-inner">
                        <ResponsiveContainer width="100%" height={260}>
                            <LineChart data={data.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                                <XAxis dataKey="time" tickFormatter={formatTime} stroke="var(--text-muted)" fontSize={11} tick={{ fill: "var(--text-muted)", opacity: 0.8 }} tickLine={false} axisLine={false} dy={10} />
                                <YAxis tickFormatter={formatEnergy} stroke="var(--text-muted)" fontSize={11} tick={{ fill: "var(--text-muted)", opacity: 0.8 }} width={55} tickLine={false} axisLine={false} dx={-10} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-light)", borderRadius: "12px", color: "var(--text-primary)", fontSize: "12px", backdropFilter: "blur(12px)", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)" }}
                                    labelFormatter={(label) => new Date(label as string).toLocaleString()}
                                    formatter={(value: number | undefined) => [formatEnergy(value ?? 0), undefined]}
                                    itemStyle={{ fontWeight: 500 }}
                                />
                                <Legend wrapperStyle={{ fontSize: "12px", color: "var(--text-secondary)", paddingTop: "10px" }} iconType="circle" />
                                {data.rooms.map((room, i) => (
                                    <Line key={room} type="monotone" dataKey={room} stroke={ROOM_COLORS[i % ROOM_COLORS.length]} strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0, style: { filter: `drop-shadow(0px 0px 5px ${ROOM_COLORS[i % ROOM_COLORS.length]}CC)` } }} name={room} />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
}
