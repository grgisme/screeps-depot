interface Props {
    activeTab: string;
    onChange: (tab: string) => void;
}

const TABS = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "rooms", label: "Rooms", icon: "🏠" },
    { id: "energy", label: "Energy", icon: "🔋" },
    { id: "performance", label: "Performance", icon: "⚡" },
    { id: "console-output", label: "Console Output", icon: "🖥️" },
    { id: "flight-recorder", label: "Flight Recorder", icon: "✈️" },
    { id: "market", label: "Market", icon: "💰" },
    { id: "system-logs", label: "System Logs", icon: "📋" },
];

export default function TabNav({ activeTab, onChange }: Props) {
    return (
        <div className="flex gap-2 rounded-2xl p-2 overflow-x-auto glass-panel mb-2 border border-[var(--border-light)] shadow-lg shadow-[var(--bg-base)] scrollbar-hide w-full max-w-full">
            {TABS.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onChange(tab.id)}
                    className={`relative px-5 py-3 rounded-xl text-sm font-medium whitespace-nowrap cursor-pointer transition-all duration-300 flex items-center gap-2 ${activeTab === tab.id
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"
                        }`}
                >
                    {activeTab === tab.id && (
                        <div className="absolute inset-0 bg-[var(--accent)]/20 border border-[var(--accent)]/30 rounded-xl shadow-[0_0_15px_var(--accent-glow)] -z-10" />
                    )}
                    <span className="opacity-90">{tab.icon}</span>
                    <span className={activeTab === tab.id ? "text-glow" : ""}>{tab.label}</span>
                </button>
            ))}
        </div>
    );
}
