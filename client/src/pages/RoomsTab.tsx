import { useState, useEffect, useCallback } from "react";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { getTickStatsRooms, type RoomsResponse } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

interface Props {
    serverId: string;
}

export default function RoomsTab({ serverId }: Props) {
    const { token } = useAuth();
    const [data, setData] = useState<RoomsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const load = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const res = await getTickStatsRooms(token, serverId);
            setData(res);
        } catch (err) {
            console.error("RoomsTab error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [token, serverId]);

    useEffect(() => { load(); }, [load]);
    useAutoRefresh(load);

    const rooms = data?.rooms ?? {};
    const roomNames = Object.keys(rooms).sort();

    if (isLoading) {
        return <p className="text-sm py-12 text-center text-[var(--text-muted)] animate-pulse">Loading architectural schematics...</p>;
    }

    if (roomNames.length === 0) {
        return (
            <div className="glass-panel rounded-2xl p-12 text-center shadow-lg shadow-[var(--bg-base)] border border-[var(--border-light)]">
                <p className="text-xl font-bold mb-3 text-glow text-[var(--text-primary)]">No Room Data</p>
                <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
                    Room data comes from your bot's StatsExporter (rooms.* keys). Make sure your bot is exporting per-room metrics.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {roomNames.map((room) => {
                const r = rooms[room];
                const rcl = r.controllerLevel as number | undefined;
                const progress = r.controllerProgress as number | undefined;
                const progressTotal = r.controllerProgressTotal as number | undefined;
                const pct = progress && progressTotal ? (progress / progressTotal * 100).toFixed(1) : null;

                return (
                    <div
                        key={room}
                        className="glass-panel-interactive rounded-2xl p-6 relative overflow-hidden flex flex-col group border border-[var(--border-light)]"
                    >
                        {/* Subtle top border highlight */}
                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-30 group-hover:opacity-100 transition-opacity duration-300"></div>

                        <div className="flex items-center justify-between mb-5 relative z-10">
                            <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                                <span className="opacity-80">🏠</span> {room}
                            </h3>
                            {rcl !== undefined && (
                                <span className="text-xs px-2.5 py-1 rounded-lg font-bold bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30 shadow-[0_0_10px_var(--accent-glow)]">
                                    RCL {rcl}
                                </span>
                            )}
                        </div>

                        {/* RCL Progress bar */}
                        {pct && (
                            <div className="mb-6 relative z-10">
                                <div className="flex items-center justify-between text-xs mb-1.5 font-medium text-[var(--text-secondary)]">
                                    <span>Controller Progress</span>
                                    <span className="text-[var(--accent)] font-mono">{pct}%</span>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden bg-[var(--bg-primary)] shadow-inner">
                                    <div
                                        className="h-full rounded-full transition-all duration-1000 ease-out bg-[var(--accent)] shadow-[0_0_10px_var(--accent-glow)] relative"
                                        style={{ width: `${pct}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 text-xs font-medium text-[var(--text-secondary)] mt-auto relative z-10 bg-[var(--bg-input)]/50 p-4 rounded-xl border border-[var(--border-light)] shadow-inner">
                            {r.energyAvailable !== undefined && (
                                <div className="flex items-center gap-1.5"><span className="text-yellow-400">⚡</span> <span className="font-mono text-[var(--text-primary)]">{String(r.energyAvailable)}<span className="opacity-50 text-[var(--text-muted)]">/{String(r.energyCapacity ?? "?")}</span></span></div>
                            )}
                            {r.storageEnergy !== undefined && (
                                <div className="flex items-center gap-1.5"><span className="text-blue-400">📦</span> <span className="font-mono text-[var(--text-primary)]">{formatNum(r.storageEnergy as number)}</span></div>
                            )}
                            {r.terminalEnergy !== undefined && (
                                <div className="flex items-center gap-1.5"><span className="text-purple-400">🔌</span> <span className="font-mono text-[var(--text-primary)]">{formatNum(r.terminalEnergy as number)}</span></div>
                            )}
                            {r.creepCount !== undefined && (
                                <div className="flex items-center gap-1.5"><span className="text-emerald-400">🤖</span> <span className="font-mono text-[var(--text-primary)]">{String(r.creepCount)}</span></div>
                            )}
                            {r.hostileCount !== undefined && (r.hostileCount as number) > 0 && (
                                <div className="flex items-center gap-1.5 text-red-400 col-span-2 mt-1 bg-red-500/10 p-2 rounded-lg border border-red-500/20"><span>⚔️</span> Hostile Presence: <span className="font-mono font-bold animate-pulse">{String(r.hostileCount)}</span></div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function formatNum(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
}
