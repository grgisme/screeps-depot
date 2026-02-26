import { type Server } from "../lib/api";

interface Props {
    servers: Server[];
    activeId: string | null;
    onChange: (id: string) => void;
}

export default function ServerSelector({ servers, activeId, onChange }: Props) {
    return (
        <div className="relative">
            <select
                id="server-selector"
                value={activeId || ""}
                onChange={(e) => onChange(e.target.value)}
                className="appearance-none rounded-lg px-4 py-2 pr-10 text-sm font-medium outline-none cursor-pointer transition-all w-full"
                style={{
                    backgroundColor: "var(--bg-input)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                }}
                onFocus={(e) =>
                    (e.target.style.borderColor = "var(--border-focus)")
                }
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            >
                {servers.length === 0 ? (
                    <option value="" disabled>
                        No servers configured
                    </option>
                ) : (
                    servers.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.name}
                        </option>
                    ))
                )}
            </select>
            <div
                className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs"
                style={{ color: "var(--text-muted)" }}
            >
                ▼
            </div>
        </div>
    );
}
