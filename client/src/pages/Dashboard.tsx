import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import {
    getServers,
    pollNow,
    type Server,
} from "../lib/api";
import ServerSelector from "../components/ServerSelector";
import ServerModal from "../components/ServerModal";
import TabNav from "../components/TabNav";
import OverviewTab from "./OverviewTab";
import RoomsTab from "./RoomsTab";
import PerformanceTab from "./PerformanceTab";
import FlightRecorderTab from "./FlightRecorderTab";
import MarketTab from "./MarketTab";
import SystemLogsTab from "./SystemLogsTab";
import EnergyTab from "./EnergyTab";
import ConsoleOutputTab from "./ConsoleOutputTab";
import { useTheme } from "../hooks/useTheme";

export default function Dashboard() {
    const { token, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();

    const [servers, setServers] = useState<Server[]>([]);
    const [activeServerId, setActiveServerId] = useState<string | null>(null);
    const [isLoadingServers, setIsLoadingServers] = useState(true);
    const [activeTab, setActiveTab] = useState("overview");

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalServer, setModalServer] = useState<Server | null>(null);
    const [isPolling, setIsPolling] = useState(false);
    const [pollStatus, setPollStatus] = useState<string | null>(null);

    // Load servers
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

    function handleServerChange(id: string) {
        setActiveServerId(id);
    }

    const activeServer = servers.find((s) => s.id === activeServerId);

    function renderActiveTab() {
        if (!activeServerId) return null;
        switch (activeTab) {
            case "overview":
                return <OverviewTab serverId={activeServerId} />;
            case "rooms":
                return <RoomsTab serverId={activeServerId} />;
            case "energy":
                return <EnergyTab serverId={activeServerId} />;
            case "performance":
                return <PerformanceTab serverId={activeServerId} />;
            case "console-output":
                return <ConsoleOutputTab serverId={activeServerId} />;
            case "flight-recorder":
                return <FlightRecorderTab serverId={activeServerId} />;
            case "market":
                return <MarketTab serverId={activeServerId} />;
            case "system-logs":
                return <SystemLogsTab serverId={activeServerId} />;
            default:
                return <OverviewTab serverId={activeServerId} />;
        }
    }

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="sticky top-0 z-50 glass-panel border-t-0 border-x-0 rounded-none border-b border-[var(--border-light)]">
                <div style={{ maxWidth: "1152px", marginLeft: "auto", marginRight: "auto", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}>
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <h1 className="text-xl font-bold tracking-tight text-glow flex items-center gap-2">
                                <span className="text-[var(--accent)]">✨</span>
                                <span style={{ color: "var(--text-primary)" }}>Screeps Depot</span>
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
                            {/* Poll status toast */}
                            {pollStatus && (
                                <span className="text-xs px-2 py-1 rounded-md" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-secondary)" }}>
                                    {pollStatus}
                                </span>
                            )}

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
                                        } catch (err) {
                                            setPollStatus(err instanceof Error ? err.message : "Poll failed");
                                        } finally {
                                            setIsPolling(false);
                                            setTimeout(() => setPollStatus(null), 4000);
                                        }
                                    }}
                                    disabled={isPolling}
                                    className="glass-panel-interactive rounded-lg px-4 py-1.5 text-sm font-medium cursor-pointer transition-all disabled:opacity-50 flex items-center gap-2"
                                    style={{ color: "var(--accent)" }}
                                >
                                    {isPolling ? "📡 Polling..." : "📡 Poll Now"}
                                </button>
                            )}
                            {activeServer && (
                                <button
                                    onClick={() => openEditModal(activeServer)}
                                    className="glass-panel-interactive rounded-lg px-4 py-1.5 text-sm font-medium cursor-pointer flex items-center gap-2"
                                    style={{ color: "var(--text-secondary)" }}
                                    title="Server Settings"
                                >
                                    ⚙️ Settings
                                </button>
                            )}
                            <button
                                onClick={toggleTheme}
                                className="glass-panel-interactive rounded-lg px-3 py-1.5 text-sm font-medium cursor-pointer transition-all hover:text-[var(--text-primary)]"
                                style={{ color: "var(--text-secondary)" }}
                                title="Toggle Theme"
                            >
                                {theme === "light" ? "🌙" : "☀️"}
                            </button>
                            <button
                                id="logout-btn"
                                onClick={logout}
                                className="glass-panel-interactive rounded-lg px-4 py-1.5 text-sm font-medium cursor-pointer hover:text-[var(--error)] transition-colors"
                                style={{ color: "var(--text-secondary)" }}
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main style={{ maxWidth: "1152px", marginLeft: "auto", marginRight: "auto", paddingLeft: "1.5rem", paddingRight: "1.5rem", paddingTop: "1.5rem", paddingBottom: "1.5rem" }}>
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
                            className="px-6 py-3 rounded-xl font-medium transition-all cursor-pointer shadow-lg shadow-[var(--accent-glow)]"
                            style={{ backgroundColor: "var(--accent)", color: "#fff" }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "var(--accent-hover)";
                                e.currentTarget.style.transform = "translateY(-2px)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "var(--accent)";
                                e.currentTarget.style.transform = "translateY(0)";
                            }}
                        >
                            <span className="mr-2">✨</span> Add Your First Server
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Tab Navigation */}
                        <div className="mb-6">
                            <TabNav activeTab={activeTab} onChange={setActiveTab} />
                        </div>

                        {/* Active Tab Content */}
                        {renderActiveTab()}
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
