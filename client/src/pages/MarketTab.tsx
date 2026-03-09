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
    return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
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
    useAutoRefresh(load);

    const data = latest?.data ?? {};

    if (isLoading && !latest) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="glass-panel rounded-xl p-4 h-20 skeleton" />
                    ))}
                </div>
                <div className="glass-panel rounded-2xl h-[340px] skeleton" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="glass-panel-interactive rounded-xl p-4 flex flex-col">
                    <p className="text-sm opacity-70 text-[var(--text-muted)]">Credits</p>
                    <p className="text-2xl font-outfit font-bold tracking-tight mt-auto" style={{ color: "var(--success)", textShadow: "0 0 20px rgba(34, 197, 94, 0.4)" }}>
                        {typeof data["market.credits"] === "number" ? formatNumber(data["market.credits"] as number) : "—"}
                    </p>
                </div>
                <div className="glass-panel-interactive rounded-xl p-4 flex flex-col">
                    <p className="text-sm opacity-70 text-[var(--text-muted)]">Active Orders</p>
                    <p className="text-2xl font-outfit font-bold tracking-tight mt-auto" style={{ color: "var(--warning)", textShadow: "0 0 20px rgba(245, 158, 11, 0.4)" }}>
                        {typeof data["market.activeOrders"] === "number" ? String(data["market.activeOrders"]) : "—"}
                    </p>
                </div>
            </div>

            {/* Credits Chart */}
            <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-30"></div>

                <div className="flex items-center justify-between mb-6 relative z-10">
                    <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
                        <span className="text-yellow-400">💰</span> Credits Over Time
                    </h3>
                    <div className="flex gap-1 p-1 bg-[var(--bg-input)] rounded-xl border border-[var(--border-light)] shadow-inner shadow-[var(--bg-base)]">
                        {[6, 24, 72, 168].map((h) => (
                            <button key={h} onClick={() => setHours(h)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all ${hours === h ? "bg-[var(--accent)] text-white shadow-md shadow-[var(--accent-glow)]" : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"}`}>
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
                            <YAxis tickFormatter={formatNumber} stroke="var(--text-muted)" fontSize={11} tick={{ fill: "var(--text-muted)", opacity: 0.8 }} width={60} tickLine={false} axisLine={false} dx={-10} />
                            <Tooltip contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-light)", borderRadius: "12px", color: "var(--text-primary)", fontSize: "12px", backdropFilter: "blur(12px)", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)" }} labelFormatter={(l) => new Date(l as string).toLocaleString()} itemStyle={{ fontWeight: 500 }} />
                            <Line type="monotone" dataKey="market.credits" stroke="var(--success)" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0, fill: "var(--success)", style: { filter: "drop-shadow(0px 0px 5px rgba(34,197,94,0.8))" } }} name="Credits" />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="text-sm text-center py-12 text-[var(--text-muted)]">
                        {isLoading ? "Loading data from Depot..." : "No market data yet. Ensure your bot exports market.* stats."}
                    </p>
                )}
            </div>
        </div>
    );
}
