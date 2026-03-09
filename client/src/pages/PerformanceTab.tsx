import { useState, useEffect, useCallback } from "react";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from "recharts";
import { getTickStatsProcesses, getTickStatsLatest, type TickStatsLatest } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

interface Props {
    serverId: string;
}

const PROCESS_COLORS = [
    "#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444",
    "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1",
    "#84cc16", "#a855f7", "#0ea5e9", "#d946ef", "#fbbf24",
];

export default function PerformanceTab({ serverId }: Props) {
    const { token } = useAuth();
    const [latest, setLatest] = useState<TickStatsLatest | null>(null);
    const [processData, setProcessData] = useState<Record<string, unknown>[]>([]);
    const [processes, setProcesses] = useState<string[]>([]);
    const [hours, setHours] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    const load = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const [latestRes, procRes] = await Promise.all([
                getTickStatsLatest(token, serverId),
                getTickStatsProcesses(token, serverId, hours),
            ]);
            if (latestRes && "tick" in latestRes) {
                setLatest(latestRes as TickStatsLatest);
            }
            setProcessData(procRes.chartData);
            setProcesses(procRes.processes);
        } catch (err) {
            console.error("PerformanceTab error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [token, serverId, hours]);

    useEffect(() => { load(); }, [load]);
    useAutoRefresh(load);

    const data = latest?.data ?? {};

    // Extract cache and heap metrics
    const systemMetrics = [
        { label: "Heap Used", value: data["heap.used"], max: data["heap.limit"], unit: "MB", divisor: 1_000_000 },
        { label: "Heap Ratio", value: data["heap.ratio"], unit: "%", multiplier: 100 },
        { label: "Cache Size", value: data["cache.size"], unit: "entries" },
        { label: "Cache Dirty", value: data["cache.dirtyCount"], unit: "" },
        { label: "Path Cache", value: data["cache.pathCacheSize"], unit: "entries" },
        { label: "Cache Commit CPU", value: data["cache.commitCPU"], unit: "ms" },
        { label: "Errors", value: data["errorMapper.totalErrors"], unit: "" },
        { label: "Unique Errors", value: data["errorMapper.uniqueFingerprints"], unit: "" },
    ].filter((m) => m.value !== undefined);

    // Extract function profiler data
    const functionMetrics: { name: string; cpu: number; calls: number; max: number }[] = [];
    for (const [key, val] of Object.entries(data)) {
        if (key.startsWith("functions.") && key.endsWith(".cpu") && typeof val === "number") {
            const name = key.replace("functions.", "").replace(".cpu", "");
            functionMetrics.push({
                name,
                cpu: val,
                calls: (data[`functions.${name}.calls`] as number) ?? 0,
                max: (data[`functions.${name}.max`] as number) ?? 0,
            });
        }
    }
    functionMetrics.sort((a, b) => b.cpu - a.cpu);

    // Skeleton loading
    if (isLoading && !latest) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="glass-panel rounded-xl p-4 h-20 skeleton" />
                    ))}
                </div>
                <div className="glass-panel rounded-2xl h-[350px] skeleton" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* System Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {systemMetrics.map((m) => {
                    let displayVal = Number(m.value);
                    if (m.divisor) displayVal /= m.divisor;
                    if (m.multiplier) displayVal *= m.multiplier;
                    return (
                        <div key={m.label} className="glass-panel-interactive rounded-xl p-4 flex flex-col">
                            <p className="text-sm opacity-70 text-[var(--text-muted)]">{m.label}</p>
                            <p className="text-2xl font-outfit font-bold tracking-tight mt-auto text-[var(--text-primary)]">
                                {`${displayVal.toFixed(m.unit === "%" ? 0 : 1)} `}
                                {m.unit && <span className="text-sm opacity-60 ml-0.5">{m.unit}</span>}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* Process CPU Chart */}
            <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-30"></div>
                <div className="flex items-center justify-between mb-6 relative z-10">
                    <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
                        <span className="text-[var(--accent)]">⚡</span> CPU by Process
                    </h3>
                    <div className="flex gap-1 p-1 bg-[var(--bg-input)] rounded-xl border border-[var(--border-light)] shadow-inner shadow-[var(--bg-base)]">
                        {[1, 6, 24].map((h) => (
                            <button key={h} onClick={() => setHours(h)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all ${hours === h ? "bg-[var(--accent)] text-white shadow-md shadow-[var(--accent-glow)]" : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"}`}>
                                {h}h
                            </button>
                        ))}
                    </div>
                </div>

                {processData.length > 0 && processes.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={processData.length > 50 ? processData.slice(-50) : processData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                            <XAxis dataKey="tick" stroke="var(--text-muted)" fontSize={10} tick={{ fill: "var(--text-muted)", opacity: 0.8 }} tickLine={false} axisLine={false} dy={10} />
                            <YAxis stroke="var(--text-muted)" fontSize={11} tick={{ fill: "var(--text-muted)", opacity: 0.8 }} width={60} tickLine={false} axisLine={false} dx={-10} />
                            <Tooltip contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-light)", borderRadius: "12px", color: "var(--text-primary)", fontSize: "12px", backdropFilter: "blur(12px)", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)" }} itemStyle={{ fontWeight: 500 }} cursor={{ fill: "var(--bg-card-hover)", opacity: 0.4 }} />
                            <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px", opacity: 0.9 }} iconType="circle" />
                            {processes.slice(0, 10).map((proc, i) => (
                                <Bar key={proc} dataKey={proc} stackId="cpu" fill={PROCESS_COLORS[i % PROCESS_COLORS.length]} radius={[2, 2, 0, 0]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="text-sm text-center py-12 text-[var(--text-muted)]">
                        {isLoading ? "Loading data from Depot..." : "No process CPU data. Make sure your bot exports processes.* stats."}
                    </p>
                )}
            </div>

            {/* Function Profiler Table */}
            {functionMetrics.length > 0 && (
                <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-30"></div>
                    <h3 className="text-base font-semibold mb-5 text-[var(--text-primary)] flex items-center gap-2 relative z-10">
                        <span className="text-[var(--accent)]">🔬</span> Function Profiler (Latest Tick)
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-[var(--border-light)]">
                                    <th className="text-left py-2 px-2 text-sm opacity-70 text-[var(--text-muted)] font-semibold">Function</th>
                                    <th className="text-right py-2 px-2 text-sm opacity-70 text-[var(--text-muted)] font-semibold">CPU (ms)</th>
                                    <th className="text-right py-2 px-2 text-sm opacity-70 text-[var(--text-muted)] font-semibold">Calls</th>
                                    <th className="text-right py-2 px-2 text-sm opacity-70 text-[var(--text-muted)] font-semibold">Max (ms)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {functionMetrics.slice(0, 20).map((fn) => (
                                    <tr key={fn.name} className="hover:bg-white/5 transition-colors">
                                        <td className="py-3 px-2 font-mono text-xs text-[var(--text-primary)]">{fn.name}</td>
                                        <td className="py-3 px-2 text-right font-mono font-medium text-blue-400">{fn.cpu.toFixed(2)}</td>
                                        <td className="py-3 px-2 text-right font-mono text-[var(--text-secondary)]">{fn.calls}</td>
                                        <td className="py-3 px-2 text-right font-mono font-medium text-amber-400">{fn.max.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
