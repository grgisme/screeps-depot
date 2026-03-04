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
        <div className="space-y-6">
            {/* KPI Cards Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Empire total */}
                <div
                    className="rounded-xl p-4"
                    style={{
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--border)",
                    }}
                >
                    <p
                        className="text-xs font-medium mb-1"
                        style={{ color: "var(--text-muted)" }}
                    >
                        🏛️ Empire Total
                    </p>
                    <p
                        className="text-2xl font-bold"
                        style={{ color: EMPIRE_COLOR }}
                    >
                        {isLoading
                            ? "..."
                            : latestEmpire !== null
                                ? formatEnergy(latestEmpire)
                                : "—"}
                    </p>
                </div>

                {/* Per-room cards */}
                {roomSummaries.map((r) => (
                    <div
                        key={r.room}
                        className="rounded-xl p-4"
                        style={{
                            backgroundColor: "var(--bg-card)",
                            border: "1px solid var(--border)",
                        }}
                    >
                        <p
                            className="text-xs font-medium mb-1"
                            style={{ color: "var(--text-muted)" }}
                        >
                            🏠 {r.room}
                        </p>
                        <p
                            className="text-xl font-bold"
                            style={{ color: r.color }}
                        >
                            {isLoading ? "..." : formatEnergy(r.value)}
                        </p>
                    </div>
                ))}
            </div>

            {/* Empire Energy Over Time */}
            <div
                className="rounded-xl p-6"
                style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                }}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3
                        className="text-sm font-semibold"
                        style={{ color: "var(--text-primary)" }}
                    >
                        🏛️ Empire Energy Over Time
                        {data && (
                            <span
                                className="font-normal ml-2"
                                style={{ color: "var(--text-muted)" }}
                            >
                                ({data.totalPoints} points)
                            </span>
                        )}
                    </h3>
                    <div className="flex gap-1">
                        {TIME_RANGES.map(({ h, label }) => (
                            <button
                                key={h}
                                onClick={() => setHours(h)}
                                className="rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer transition-all"
                                style={{
                                    backgroundColor:
                                        hours === h
                                            ? "var(--accent)"
                                            : "transparent",
                                    color:
                                        hours === h
                                            ? "#fff"
                                            : "var(--text-muted)",
                                    border: `1px solid ${hours === h ? "var(--accent)" : "var(--border)"}`,
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {isLoading ? (
                    <div
                        className="h-64 rounded-lg animate-pulse"
                        style={{ backgroundColor: "var(--bg-primary)" }}
                    />
                ) : !data ||
                    data.chartData.length === 0 ? (
                    <p
                        className="text-sm text-center py-12"
                        style={{ color: "var(--text-muted)" }}
                    >
                        No energy data available yet. Make sure your bot exports
                        rooms.*.energyAvailable stats.
                    </p>
                ) : (
                    <div
                        className="rounded-lg p-4"
                        style={{
                            backgroundColor: "var(--bg-primary)",
                            border: "1px solid var(--border)",
                        }}
                    >
                        <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={data.chartData}>
                                <defs>
                                    {data.rooms.map((room, i) => (
                                        <linearGradient
                                            key={room}
                                            id={`grad-${room}`}
                                            x1="0"
                                            y1="0"
                                            x2="0"
                                            y2="1"
                                        >
                                            <stop
                                                offset="5%"
                                                stopColor={
                                                    ROOM_COLORS[
                                                    i %
                                                    ROOM_COLORS.length
                                                    ]
                                                }
                                                stopOpacity={0.4}
                                            />
                                            <stop
                                                offset="95%"
                                                stopColor={
                                                    ROOM_COLORS[
                                                    i %
                                                    ROOM_COLORS.length
                                                    ]
                                                }
                                                stopOpacity={0.05}
                                            />
                                        </linearGradient>
                                    ))}
                                </defs>
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
                                    tickFormatter={formatEnergy}
                                    stroke="var(--text-muted)"
                                    fontSize={11}
                                    tick={{ fill: "var(--text-muted)" }}
                                    width={55}
                                />
                                <Tooltip
                                    contentStyle={tooltipStyle}
                                    labelFormatter={(label) =>
                                        new Date(
                                            label as string
                                        ).toLocaleString()
                                    }
                                    formatter={(
                                        value: number | undefined,
                                        name?: string
                                    ) => [
                                            formatEnergy(value ?? 0),
                                            name === "empire"
                                                ? "Empire Total"
                                                : (name ?? ""),
                                        ]}
                                />
                                <Legend
                                    wrapperStyle={{
                                        fontSize: "12px",
                                        color: "var(--text-secondary)",
                                    }}
                                    formatter={(value: string) =>
                                        value === "empire"
                                            ? "Empire Total"
                                            : value
                                    }
                                />
                                {data.rooms.map((room, i) => (
                                    <Area
                                        key={room}
                                        type="monotone"
                                        dataKey={room}
                                        stackId="energy"
                                        stroke={
                                            ROOM_COLORS[
                                            i % ROOM_COLORS.length
                                            ]
                                        }
                                        fill={`url(#grad-${room})`}
                                        strokeWidth={1.5}
                                        name={room}
                                    />
                                ))}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Per-Room Breakdown */}
            {data && data.rooms.length > 0 && data.chartData.length > 0 && (
                <div
                    className="rounded-xl p-6"
                    style={{
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--border)",
                    }}
                >
                    <h3
                        className="text-sm font-semibold mb-4"
                        style={{ color: "var(--text-primary)" }}
                    >
                        🏠 Per-Room Energy Breakdown
                    </h3>
                    <div
                        className="rounded-lg p-4"
                        style={{
                            backgroundColor: "var(--bg-primary)",
                            border: "1px solid var(--border)",
                        }}
                    >
                        <ResponsiveContainer width="100%" height={240}>
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
                                    tickFormatter={formatEnergy}
                                    stroke="var(--text-muted)"
                                    fontSize={11}
                                    tick={{ fill: "var(--text-muted)" }}
                                    width={55}
                                />
                                <Tooltip
                                    contentStyle={tooltipStyle}
                                    labelFormatter={(label) =>
                                        new Date(
                                            label as string
                                        ).toLocaleString()
                                    }
                                    formatter={(value: number | undefined) => [
                                        formatEnergy(value ?? 0),
                                        undefined,
                                    ]}
                                />
                                <Legend
                                    wrapperStyle={{
                                        fontSize: "12px",
                                        color: "var(--text-secondary)",
                                    }}
                                />
                                {data.rooms.map((room, i) => (
                                    <Line
                                        key={room}
                                        type="monotone"
                                        dataKey={room}
                                        stroke={
                                            ROOM_COLORS[
                                            i % ROOM_COLORS.length
                                            ]
                                        }
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                        name={room}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
}
