import { useState, useEffect, useCallback } from "react";
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

    const rooms = data?.rooms ?? {};
    const roomNames = Object.keys(rooms).sort();

    if (isLoading) {
        return <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>Loading rooms...</p>;
    }

    if (roomNames.length === 0) {
        return (
            <div className="rounded-xl p-8 text-center" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <p className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>No Room Data</p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Room data comes from your bot's StatsExporter (rooms.* keys). Make sure your bot is exporting per-room metrics.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roomNames.map((room) => {
                const r = rooms[room];
                const rcl = r.controllerLevel as number | undefined;
                const progress = r.controllerProgress as number | undefined;
                const progressTotal = r.controllerProgressTotal as number | undefined;
                const pct = progress && progressTotal ? (progress / progressTotal * 100).toFixed(1) : null;

                return (
                    <div
                        key={room}
                        className="rounded-xl p-5"
                        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                                🏠 {room}
                            </h3>
                            {rcl !== undefined && (
                                <span
                                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                    style={{ backgroundColor: "var(--accent)", color: "#fff" }}
                                >
                                    RCL {rcl}
                                </span>
                            )}
                        </div>

                        {/* RCL Progress bar */}
                        {pct && (
                            <div className="mb-3">
                                <div className="flex items-center justify-between text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                                    <span>Controller</span>
                                    <span>{pct}%</span>
                                </div>
                                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-primary)" }}>
                                    <div
                                        className="h-full rounded-full transition-all"
                                        style={{ width: `${pct}%`, backgroundColor: "var(--accent)" }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                            {r.energyAvailable !== undefined && (
                                <div>⚡ Energy: <span className="font-mono">{String(r.energyAvailable)}/{String(r.energyCapacity ?? "?")}</span></div>
                            )}
                            {r.storageEnergy !== undefined && (
                                <div>📦 Storage: <span className="font-mono">{formatNum(r.storageEnergy as number)}</span></div>
                            )}
                            {r.terminalEnergy !== undefined && (
                                <div>🔌 Terminal: <span className="font-mono">{formatNum(r.terminalEnergy as number)}</span></div>
                            )}
                            {r.creepCount !== undefined && (
                                <div>🤖 Creeps: <span className="font-mono">{String(r.creepCount)}</span></div>
                            )}
                            {r.hostileCount !== undefined && (r.hostileCount as number) > 0 && (
                                <div style={{ color: "#ef4444" }}>⚔️ Hostile: <span className="font-mono">{String(r.hostileCount)}</span></div>
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
