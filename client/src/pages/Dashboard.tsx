import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import {
    getServers,
    pollNow,
    type Server,
} from "../lib/api";
import ServerSelector from "../components/ServerSelector";
import ServerModal from "../components/ServerModal";
import OverviewTab from "./OverviewTab";
import RoomsTab from "./RoomsTab";
import PerformanceTab from "./PerformanceTab";
import FlightRecorderTab from "./FlightRecorderTab";
import MarketTab from "./MarketTab";
import SystemLogsTab from "./SystemLogsTab";
import EnergyTab from "./EnergyTab";
import ConsoleOutputTab from "./ConsoleOutputTab";
import { useTheme } from "../hooks/useTheme";

const NAV_ITEMS = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "rooms", label: "Rooms", icon: "🏠" },
    { id: "energy", label: "Energy", icon: "🔋" },
    { id: "performance", label: "Performance", icon: "⚡" },
    { id: "console-output", label: "Console", icon: "🖥️" },
    { id: "flight-recorder", label: "Flight Rec", icon: "✈️" },
    { id: "market", label: "Market", icon: "💰" },
    { id: "system-logs", label: "Logs", icon: "📋" },
];

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

    // Mobile sidebar toggle
    const [sidebarOpen, setSidebarOpen] = useState(false);

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

    function handleNavClick(tabId: string) {
        setActiveTab(tabId);
        setSidebarOpen(false); // close on mobile after selection
    }

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
        <div className="flex h-screen overflow-hidden">
            {/* ── Mobile overlay ── */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ── Sidebar ── */}
            <aside
                className={`
                    sidebar fixed md:sticky top-0 left-0 z-50 h-screen flex flex-col
                    w-[260px] shrink-0
                    glass-panel border-t-0 border-l-0 border-b-0 rounded-none border-r border-[var(--border-light)]
                    transition-transform duration-300 ease-in-out
                    ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
                `}
            >
                {/* Brand */}
                <div className="px-6 pt-6 pb-4">
                    <h1 className="text-lg font-bold tracking-tight text-glow flex items-center gap-2">
                        <span className="text-[var(--accent)]">✨</span>
                        <span style={{ color: "var(--text-primary)" }}>Screeps Depot</span>
                    </h1>
                </div>

                {/* Server selector */}
                {!isLoadingServers && servers.length > 0 && (
                    <div className="px-4 pb-4">
                        <ServerSelector
                            servers={servers}
                            activeId={activeServerId}
                            onChange={handleServerChange}
                            onAddServer={openCreateModal}
                        />
                    </div>
                )}

                {/* Divider */}
                <div className="mx-4 h-px bg-[var(--border-light)]" />

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                    {NAV_ITEMS.map((item) => {
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => handleNavClick(item.id)}
                                className={`
                                    sidebar-item w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                                    cursor-pointer transition-all duration-200
                                    ${isActive
                                        ? "sidebar-item-active bg-[var(--accent)]/15 text-[var(--text-primary)] border border-[var(--accent)]/25 shadow-[0_0_12px_var(--accent-glow)]"
                                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] border border-transparent"
                                    }
                                `}
                            >
                                <span className="text-base">{item.icon}</span>
                                <span className={isActive ? "text-glow" : ""}>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                {/* Divider */}
                <div className="mx-4 h-px bg-[var(--border-light)]" />

                {/* Bottom utilities */}
                <div className="px-4 py-4 space-y-2">
                    {/* Poll status toast */}
                    {pollStatus && (
                        <div className="text-xs px-3 py-2 rounded-lg mb-1" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-secondary)" }}>
                            {pollStatus}
                        </div>
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
                            className="sidebar-item w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all text-[var(--accent)] hover:bg-[var(--bg-card-hover)] border border-transparent disabled:opacity-50"
                        >
                            <span className="text-base">{isPolling ? "📡" : "📡"}</span>
                            <span>{isPolling ? "Polling..." : "Poll Now"}</span>
                        </button>
                    )}

                    {activeServer && (
                        <button
                            onClick={() => openEditModal(activeServer)}
                            className="sidebar-item w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] border border-transparent"
                            title="Server Settings"
                        >
                            <span className="text-base">⚙️</span>
                            <span>Settings</span>
                        </button>
                    )}

                    <button
                        onClick={toggleTheme}
                        className="sidebar-item w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] border border-transparent"
                        title="Toggle Theme"
                    >
                        <span className="text-base">{theme === "light" ? "🌙" : "☀️"}</span>
                        <span>{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
                    </button>

                    <button
                        id="logout-btn"
                        onClick={logout}
                        className="sidebar-item w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--bg-card-hover)] border border-transparent"
                    >
                        <span className="text-base">🚪</span>
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* ── Main Content ── */}
            <main className="flex-1 overflow-y-auto min-h-screen">
                {/* Mobile header with hamburger */}
                <div className="sticky top-0 z-30 md:hidden glass-panel border-x-0 border-t-0 rounded-none border-b border-[var(--border-light)] px-4 py-3 flex items-center gap-3">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 rounded-lg hover:bg-[var(--bg-card-hover)] cursor-pointer transition-colors"
                        aria-label="Open menu"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-primary)" }}>
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                    </button>
                    <h1 className="text-base font-bold text-glow flex items-center gap-2">
                        <span className="text-[var(--accent)]">✨</span>
                        <span style={{ color: "var(--text-primary)" }}>Screeps Depot</span>
                    </h1>
                </div>

                <div className="p-6 md:p-10 max-w-[1200px] mx-auto">
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
                        renderActiveTab()
                    )}

                    {isModalOpen && (
                        <ServerModal
                            server={modalServer}
                            onClose={() => setIsModalOpen(false)}
                            onSave={handleServerSaved}
                        />
                    )}
                </div>
            </main>
        </div>
    );
}
