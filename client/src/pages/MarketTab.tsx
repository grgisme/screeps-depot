import { useState, useEffect, useCallback } from "react";
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
    return value.toFixed(0);
}

function formatTime(isoString: string): string {
    return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function MarketTab({ serverId }: Props) {
    const { token } = useAuth();
    const [latest, setLatest] = useState<TickStatsLatest | null>(null);
    const [chartData, setChartData] = useState<Record<string, unknown>[]>([]);
    const [hours, setHours] = useState(24);
    const [isLoading, setIsLoading] = useState(true);

    const load = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const [latestRes, chartRes] = await Promise.all([
                getTickStatsLatest(token, serverId),
                getTickStats(token, serverId, hours, ["market.credits", "market.activeOrders"]),
            ]);
            if (latestRes && "tick" in latestRes) setLatest(latestRes as TickStatsLatest);
            setChartData(chartRes.chartData);
        } catch (err) {
            console.error("MarketTab error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [token, serverId, hours]);

    useEffect(() => { load(); }, [load]);

    const data = latest?.data ?? {};

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                    <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Credits</p>
                    <p className="text-3xl font-bold" style={{ color: "#22c55e" }}>
                        {isLoading ? "..." : typeof data["market.credits"] === "number" ? formatNumber(data["market.credits"] as number) : "—"}
                    </p>
                </div>
                <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                    <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Active Orders</p>
                    <p className="text-3xl font-bold" style={{ color: "#f59e0b" }}>
                        {isLoading ? "..." : typeof data["market.activeOrders"] === "number" ? String(data["market.activeOrders"]) : "—"}
                    </p>
                </div>
            </div>

            {/* Credits Chart */}
            <div className="rounded-xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>💰 Credits Over Time</h3>
                    <div className="flex gap-1">
                        {[6, 24, 72, 168].map((h) => (
                            <button key={h} onClick={() => setHours(h)} className="rounded-md px-2 py-1 text-xs font-medium cursor-pointer transition-all"
                                style={{ backgroundColor: hours === h ? "var(--accent)" : "transparent", color: hours === h ? "#fff" : "var(--text-muted)", border: `1px solid ${hours === h ? "var(--accent)" : "var(--border)"}` }}>
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
                            <YAxis tickFormatter={formatNumber} stroke="var(--text-muted)" fontSize={11} tick={{ fill: "var(--text-muted)" }} width={60} />
                            <Tooltip contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "12px" }}
                                labelFormatter={(l) => new Date(l as string).toLocaleString()} />
                            <Line type="monotone" dataKey="market.credits" stroke="#22c55e" strokeWidth={2} dot={false} name="Credits" />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
                        {isLoading ? "Loading..." : "No market data yet. Ensure your bot exports market.* stats."}
                    </p>
                )}
            </div>
        </div>
    );
}
