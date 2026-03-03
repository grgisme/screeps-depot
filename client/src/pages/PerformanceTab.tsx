import { useState, useEffect, useCallback } from "react";
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

    return (
        <div className="space-y-6">
            {/* System Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {systemMetrics.map((m) => {
                    let displayVal = Number(m.value);
                    if (m.divisor) displayVal /= m.divisor;
                    if (m.multiplier) displayVal *= m.multiplier;
                    return (
                        <div key={m.label} className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                            <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>{m.label}</p>
                            <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                                {isLoading ? "..." : `${displayVal.toFixed(m.unit === "%" ? 0 : 1)} ${m.unit}`}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* Process CPU Chart */}
            <div className="rounded-xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        ⚡ CPU by Process
                    </h3>
                    <div className="flex gap-1">
                        {[1, 6, 24].map((h) => (
                            <button key={h} onClick={() => setHours(h)} className="rounded-md px-2 py-1 text-xs font-medium cursor-pointer transition-all"
                                style={{ backgroundColor: hours === h ? "var(--accent)" : "transparent", color: hours === h ? "#fff" : "var(--text-muted)", border: `1px solid ${hours === h ? "var(--accent)" : "var(--border)"}` }}>
                                {h}h
                            </button>
                        ))}
                    </div>
                </div>

                {processData.length > 0 && processes.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={processData.length > 50 ? processData.slice(-50) : processData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="tick" stroke="var(--text-muted)" fontSize={10} tick={{ fill: "var(--text-muted)" }} />
                            <YAxis stroke="var(--text-muted)" fontSize={11} tick={{ fill: "var(--text-muted)" }} width={40} />
                            <Tooltip contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "11px" }} />
                            <Legend wrapperStyle={{ fontSize: "11px" }} />
                            {processes.slice(0, 10).map((proc, i) => (
                                <Bar key={proc} dataKey={proc} stackId="cpu" fill={PROCESS_COLORS[i % PROCESS_COLORS.length]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
                        {isLoading ? "Loading..." : "No process CPU data. Make sure your bot exports processes.* stats."}
                    </p>
                )}
            </div>

            {/* Function Profiler Table */}
            {functionMetrics.length > 0 && (
                <div className="rounded-xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                    <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                        🔬 Function Profiler (Latest Tick)
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ color: "var(--text-muted)" }}>
                                    <th className="text-left py-2 px-3 font-medium">Function</th>
                                    <th className="text-right py-2 px-3 font-medium">CPU (ms)</th>
                                    <th className="text-right py-2 px-3 font-medium">Calls</th>
                                    <th className="text-right py-2 px-3 font-medium">Max (ms)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {functionMetrics.slice(0, 20).map((fn) => (
                                    <tr key={fn.name} style={{ borderTop: "1px solid var(--border)" }}>
                                        <td className="py-2 px-3 font-mono text-xs" style={{ color: "var(--text-primary)" }}>{fn.name}</td>
                                        <td className="py-2 px-3 text-right font-mono" style={{ color: "#3b82f6" }}>{fn.cpu.toFixed(2)}</td>
                                        <td className="py-2 px-3 text-right font-mono" style={{ color: "var(--text-secondary)" }}>{fn.calls}</td>
                                        <td className="py-2 px-3 text-right font-mono" style={{ color: "#f59e0b" }}>{fn.max.toFixed(2)}</td>
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
