import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import {
    getServers,
    getServerStats,
    getServerLogs,
    pollNow,
    type Server,
    type Stat,
    type Log,
} from "../lib/api";
import ServerSelector from "../components/ServerSelector";
import StatsPanel from "../components/StatsPanel";
import LogsPanel from "../components/LogsPanel";
import StatsCharts from "../components/StatsCharts";
import LogViewer from "../components/LogViewer";
import ServerModal from "../components/ServerModal";
export default function Dashboard() {
    const { token, logout } = useAuth();

    const [servers, setServers] = useState<Server[]>([]);
    const [activeServerId, setActiveServerId] = useState<string | null>(null);
    const [stats, setStats] = useState<Stat[]>([]);
    const [logs, setLogs] = useState<Log[]>([]);
    const [isLoadingServers, setIsLoadingServers] = useState(true);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [severityFilter, setSeverityFilter] = useState("");

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalServer, setModalServer] = useState<Server | null>(null);
    const [isPolling, setIsPolling] = useState(false);
    const [pollStatus, setPollStatus] = useState<string | null>(null);

    // Load servers function to be reusable across mount and CRUD
    const fetchServers = useCallback(async () => {
        if (!token) return [];
        try {
            const data = await getServers(token);
            setServers(data);
            return data;
        } catch (err) {
            console.error("Failed to load servers:", err);
            return [];
        }
    }, [token]);

    // Load servers on mount
    useEffect(() => {
        if (!token) return;
        setIsLoadingServers(true);
        fetchServers()
            .then((data) => {
                if (data.length > 0) setActiveServerId(data[0].id);
            })
            .finally(() => setIsLoadingServers(false));
    }, [token, fetchServers]);

    async function handleServerSaved() {
        const data = await fetchServers();
        // If no active server, or active server was deleted, select the first one (or null)
        if (data.length === 0) {
            setActiveServerId(null);
        } else if (!activeServerId || !data.find(s => s.id === activeServerId)) {
            setActiveServerId(data[0].id);
        }
    }

    function openCreateModal() {
        setModalServer(null);
        setIsModalOpen(true);
    }

    function openEditModal(server: Server) {
        setModalServer(server);
        setIsModalOpen(true);
    }

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
                                <div className="w-56">
                                    <ServerSelector
                                        servers={servers}
                                        activeId={activeServerId}
                                        onChange={handleServerChange}
                                        onAddServer={openCreateModal}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            {activeServerId && activeServer?.apiToken && (
                                <button
                                    id="poll-now"
                                    onClick={async () => {
                                        if (!token || !activeServerId) return;
                                        setIsPolling(true);
                                        setPollStatus(null);
                                        try {
                                            const result = await pollNow(token, activeServerId);
                                            setPollStatus(result.message);
                                            // Refresh data after polling
                                            loadData(activeServerId, severityFilter);
                                        } catch (err) {
                                            setPollStatus(err instanceof Error ? err.message : "Poll failed");
                                        } finally {
                                            setIsPolling(false);
                                            setTimeout(() => setPollStatus(null), 4000);
                                        }
                                    }}
                                    disabled={isPolling}
                                    className="rounded-lg px-3 py-1.5 text-sm cursor-pointer transition-all disabled:opacity-50"
                                    style={{
                                        backgroundColor: "transparent",
                                        border: "1px solid var(--border)",
                                        color: "var(--accent)",
                                    }}
                                    onMouseEnter={(e) =>
                                        (e.currentTarget.style.borderColor = "var(--accent)")
                                    }
                                    onMouseLeave={(e) =>
                                        (e.currentTarget.style.borderColor = "var(--border)")
                                    }
                                >
                                    {isPolling ? "Polling..." : "📡 Poll Now"}
                                </button>
                            )}
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
                        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                            Start tracking your stats and logs by adding a Screeps server.
                        </p>
                        <button
                            onClick={openCreateModal}
                            className="px-6 py-3 rounded-xl font-medium transition-colors cursor-pointer"
                            style={{ backgroundColor: "var(--accent)", color: "#fff" }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-hover)")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--accent)")}
                        >
                            + Add Your First Server
                        </button>
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
                                <div className="flex items-center gap-3">
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
                                    <button
                                        onClick={() => openEditModal(activeServer)}
                                        className="p-1.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center"
                                        style={{ backgroundColor: "var(--bg-primary)" }}
                                        title="Server Settings"
                                    >
                                        <span role="img" aria-label="settings" className="text-sm">⚙️</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Charts */}
                        {activeServerId && (
                            <div className="mb-6">
                                <StatsCharts serverId={activeServerId} />
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

                        {/* Log Viewer */}
                        {activeServerId && (
                            <div className="mt-6">
                                <LogViewer serverId={activeServerId} />
                            </div>
                        )}
                    </>
                )}

                {isModalOpen && (
                    <ServerModal
                        server={modalServer}
                        onClose={() => setIsModalOpen(false)}
                        onSave={handleServerSaved}
                    />
                )}
            </main>
        </div>
    );
}
