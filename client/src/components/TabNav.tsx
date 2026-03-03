interface Props {
    activeTab: string;
    onChange: (tab: string) => void;
}

const TABS = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "rooms", label: "Rooms", icon: "🏠" },
    { id: "performance", label: "Performance", icon: "⚡" },
    { id: "flight-recorder", label: "Flight Recorder", icon: "✈️" },
    { id: "market", label: "Market", icon: "💰" },
    { id: "system-logs", label: "System Logs", icon: "📋" },
];

export default function TabNav({ activeTab, onChange }: Props) {
    return (
        <div
            className="flex gap-1 rounded-xl p-1 overflow-x-auto"
            style={{ backgroundColor: "var(--bg-secondary)" }}
        >
            {TABS.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onChange(tab.id)}
                    className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap cursor-pointer transition-all"
                    style={{
                        backgroundColor:
                            activeTab === tab.id ? "var(--bg-card)" : "transparent",
                        color:
                            activeTab === tab.id
                                ? "var(--text-primary)"
                                : "var(--text-muted)",
                        boxShadow:
                            activeTab === tab.id
                                ? "0 1px 3px rgba(0,0,0,0.2)"
                                : "none",
                    }}
                >
                    {tab.icon} {tab.label}
                </button>
            ))}
        </div>
    );
}
