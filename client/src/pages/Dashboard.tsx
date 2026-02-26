import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import {
    getServers,
    getServerStats,
    getServerLogs,
    type Server,
    type Stat,
    type Log,
} from "../lib/api";
import ServerSelector from "../components/ServerSelector";
import StatsPanel from "../components/StatsPanel";
import LogsPanel from "../components/LogsPanel";

export default function Dashboard() {
    const { token, logout } = useAuth();

    const [servers, setServers] = useState<Server[]>([]);
    const [activeServerId, setActiveServerId] = useState<string | null>(null);
    const [stats, setStats] = useState<Stat[]>([]);
    const [logs, setLogs] = useState<Log[]>([]);
    const [isLoadingServers, setIsLoadingServers] = useState(true);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [severityFilter, setSeverityFilter] = useState("");

    // Load servers on mount
    useEffect(() => {
        if (!token) return;
        setIsLoadingServers(true);
        getServers(token)
            .then((data) => {
                setServers(data);
                if (data.length > 0) {
                    setActiveServerId(data[0].id);
                }
            })
            .catch((err) => console.error("Failed to load servers:", err))
            .finally(() => setIsLoadingServers(false));
    }, [token]);

    // Load stats + logs when active server changes
    const loadData = useCallback(
        async (serverId: string, severity: string = "") => {
            if (!token) return;
            setIsLoadingData(true);
            try {
                const [statsData, logsData] = await Promise.all([
                    getServerStats(token, serverId),
                    getServerLogs(token, serverId, severity || undefined),
                ]);
                setStats(statsData);
                setLogs(logsData);
            } catch (err) {
                console.error("Failed to load data:", err);
            } finally {
                setIsLoadingData(false);
            }
        },
        [token]
    );

    useEffect(() => {
        if (activeServerId) {
            loadData(activeServerId, severityFilter);
        }
    }, [activeServerId, loadData, severityFilter]);

    function handleServerChange(id: string) {
        setActiveServerId(id);
        setSeverityFilter("");
    }

    function handleSeverityFilter(severity: string) {
        setSeverityFilter(severity);
    }

    const activeServer = servers.find((s) => s.id === activeServerId);

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header
                className="sticky top-0 z-10"
                style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderBottom: "1px solid var(--border)",
                    backdropFilter: "blur(12px)",
                }}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <h1
                                className="text-xl font-bold"
                                style={{ color: "var(--text-primary)" }}
                            >
                                🏗️ Screeps Depot
                            </h1>

                            {!isLoadingServers && servers.length > 0 && (
                                <div className="w-48">
                                    <ServerSelector
                                        servers={servers}
                                        activeId={activeServerId}
                                        onChange={handleServerChange}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                id="refresh-data"
                                onClick={() =>
                                    activeServerId &&
                                    loadData(activeServerId, severityFilter)
                                }
                                className="rounded-lg px-3 py-1.5 text-sm cursor-pointer transition-all"
                                style={{
                                    backgroundColor: "transparent",
                                    border: "1px solid var(--border)",
                                    color: "var(--text-secondary)",
                                }}
                                onMouseEnter={(e) =>
                                    (e.currentTarget.style.borderColor = "var(--accent)")
                                }
                                onMouseLeave={(e) =>
                                    (e.currentTarget.style.borderColor = "var(--border)")
                                }
                            >
                                ↻ Refresh
                            </button>
                            <button
                                id="logout-btn"
                                onClick={logout}
                                className="rounded-lg px-3 py-1.5 text-sm cursor-pointer transition-all"
                                style={{
                                    backgroundColor: "transparent",
                                    border: "1px solid var(--border)",
                                    color: "var(--text-secondary)",
                                }}
                                onMouseEnter={(e) =>
                                    (e.currentTarget.style.borderColor = "var(--error)")
                                }
                                onMouseLeave={(e) =>
                                    (e.currentTarget.style.borderColor = "var(--border)")
                                }
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {isLoadingServers ? (
                    <div className="flex items-center justify-center py-20">
                        <div
                            className="animate-pulse text-lg"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            Loading servers...
                        </div>
                    </div>
                ) : servers.length === 0 ? (
                    <div
                        className="rounded-xl p-12 text-center"
                        style={{
                            backgroundColor: "var(--bg-card)",
                            border: "1px solid var(--border)",
                        }}
                    >
                        <p
                            className="text-lg mb-2"
                            style={{ color: "var(--text-primary)" }}
                        >
                            No Screeps servers configured
                        </p>
                        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                            Use the API to add a server:{" "}
                            <code
                                className="rounded px-2 py-1 text-xs"
                                style={{
                                    backgroundColor: "var(--bg-primary)",
                                    color: "var(--accent)",
                                }}
                            >
                                POST /api/servers
                            </code>
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Server info bar */}
                        {activeServer && (
                            <div
                                className="rounded-xl px-5 py-3 mb-6 flex items-center justify-between"
                                style={{
                                    backgroundColor: "var(--bg-card)",
                                    border: "1px solid var(--border)",
                                }}
                            >
                                <div className="flex items-center gap-4">
                                    <span
                                        className="text-sm font-medium"
                                        style={{ color: "var(--text-primary)" }}
                                    >
                                        {activeServer.name}
                                    </span>
                                    <span
                                        className="text-xs"
                                        style={{ color: "var(--text-muted)" }}
                                    >
                                        Polling:{" "}
                                        <span
                                            style={{
                                                color: activeServer.pollingEnabled
                                                    ? "var(--success)"
                                                    : "var(--text-muted)",
                                            }}
                                        >
                                            {activeServer.pollingEnabled ? "ON" : "OFF"}
                                        </span>
                                    </span>
                                </div>
                                <span
                                    className="text-xs font-mono"
                                    style={{ color: "var(--text-muted)" }}
                                >
                                    Push token:{" "}
                                    <code
                                        className="rounded px-1.5 py-0.5"
                                        style={{
                                            backgroundColor: "var(--bg-primary)",
                                            color: "var(--text-secondary)",
                                        }}
                                    >
                                        {activeServer.pushToken.slice(0, 8)}...
                                    </code>
                                </span>
                            </div>
                        )}

                        {/* Data panels */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <StatsPanel stats={stats} isLoading={isLoadingData} />
                            <LogsPanel
                                logs={logs}
                                isLoading={isLoadingData}
                                onFilterChange={handleSeverityFilter}
                            />
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
