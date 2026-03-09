import { type Server } from "../lib/api";

interface Props {
    servers: Server[];
    activeId: string | null;
    onChange: (id: string) => void;
    onAddServer?: () => void;
}

export default function ServerSelector({ servers, activeId, onChange, onAddServer }: Props) {
    return (
        <div className="flex gap-2">
            <div className="relative flex-1">
                <select
                    id="server-selector"
                    value={activeId || ""}
                    onChange={(e) => onChange(e.target.value)}
                    className="appearance-none rounded-xl px-4 py-2 pr-10 text-sm font-medium outline-none cursor-pointer transition-all w-full glass-panel-interactive text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent)]/50 focus:border-[var(--accent)] bg-transparent"
                >
                    {servers.length === 0 ? (
                        <option value="" disabled className="bg-[var(--bg-card)]">
                            No servers configured
                        </option>
                    ) : (
                        servers.map((s) => (
                            <option key={s.id} value={s.id} className="bg-[var(--bg-card)]">
                                {s.name}
                            </option>
                        ))
                    )}
                </select>
                <div
                    className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[8px] opacity-70"
                    style={{ color: "var(--text-primary)" }}
                >
                    ▼
                </div>
            </div>

            {onAddServer && (
                <button
                    onClick={onAddServer}
                    className="px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-md shadow-[var(--accent-glow)] hover:shadow-lg hover:shadow-[var(--accent-glow)] hover:-translate-y-0.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white"
                    title="Add Server"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
            )}
        </div>
    );
}
