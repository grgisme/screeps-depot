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

export default function Dashboard() {
    const { token, logout } = useAuth();

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
            <header
                className="sticky top-0 z-10"
                style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderBottom: "1px solid var(--border)",
                    backdropFilter: "blur(12px)",
                }}
            >
                <div style={{ maxWidth: "1152px", marginLeft: "auto", marginRight: "auto", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}>
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
                            {activeServer && (
                                <button
                                    onClick={() => openEditModal(activeServer)}
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
                                    title="Server Settings"
                                >
                                    ⚙️ Settings
                                </button>
                            )}
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
