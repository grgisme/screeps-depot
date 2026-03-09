import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Server, createServer, updateServer, deleteServer, regeneratePushToken } from "../lib/api";

interface ServerModalProps {
    server?: Server | null;
    onClose: () => void;
    onSave: () => void;
}

export default function ServerModal({ server, onClose, onSave }: ServerModalProps) {
    const { token } = useAuth();
    const isEdit = !!server;

    const [name, setName] = useState(server?.name || "");
    const [apiToken, setApiToken] = useState(server?.apiToken || "");
    const [apiBaseUrl, setApiBaseUrl] = useState(server?.apiBaseUrl || "https://screeps.com");
    const [shard, setShard] = useState(server?.shard || "shard3");
    const [pollingEnabled, setPollingEnabled] = useState(server?.pollingEnabled || false);

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!token) return;

        setIsSaving(true);
        setError(null);

        try {
            if (isEdit && server) {
                await updateServer(token, server.id, { name, apiToken, apiBaseUrl, shard, pollingEnabled });
            } else {
                await createServer(token, { name, apiToken, apiBaseUrl, shard, pollingEnabled });
            }
            onSave();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save server");
            setIsSaving(false);
        }
    }

    async function handleDelete() {
        if (!token || !server) return;
        if (!window.confirm("Are you sure you want to delete this server? This will also delete all associated stats and logs. This action cannot be undone.")) return;

        setIsSaving(true);
        setError(null);
        try {
            await deleteServer(token, server.id);
            onSave();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete server");
            setIsSaving(false);
        }
    }

    async function handleRegenerate() {
        if (!token || !server) return;
        if (!window.confirm("Regenerate push token? Any external scripts using the old token will lose access immediately.")) return;

        setIsSaving(true);
        setError(null);
        try {
            await regeneratePushToken(token, server.id);
            onSave();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to regenerate token");
            setIsSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(4px)" }}>
            <div
                className="w-full max-w-md rounded-xl p-8 shadow-xl"
                style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)"
                }}
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                        {isEdit ? "Edit Server settings" : "Add new Server"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-xl leading-none cursor-pointer"
                        style={{ color: "var(--text-muted)" }}
                        onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
                        onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
                    >
                        &times;
                    </button>
                </div>

                {error && (
                    <div
                        className="rounded-lg px-4 py-3 mb-6 text-sm flex items-center justify-between"
                        style={{
                            backgroundColor: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            color: "var(--error)",
                        }}
                    >
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="ml-2 hover:opacity-70 cursor-pointer">✕</button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                            Server Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                            placeholder="e.g. MMO, Season 8, Localhost"
                            className="w-full rounded-lg px-4 py-2 text-sm outline-none transition-all"
                            style={{
                                backgroundColor: "var(--bg-input)",
                                border: "1px solid var(--border)",
                                color: "var(--text-primary)",
                            }}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                            API Base URL
                        </label>
                        <input
                            type="url"
                            value={apiBaseUrl}
                            onChange={e => setApiBaseUrl(e.target.value)}
                            required
                            className="w-full rounded-lg px-4 py-2 text-sm outline-none transition-all"
                            style={{
                                backgroundColor: "var(--bg-input)",
                                border: "1px solid var(--border)",
                                color: "var(--text-primary)",
                            }}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                            Screeps API Token
                        </label>
                        <input
                            type="password"
                            value={apiToken}
                            onChange={e => setApiToken(e.target.value)}
                            placeholder="Optional: Used for Pull Mode"
                            className="w-full rounded-lg px-4 py-2 text-sm outline-none transition-all"
                            style={{
                                backgroundColor: "var(--bg-input)",
                                border: "1px solid var(--border)",
                                color: "var(--text-primary)",
                            }}
                        />
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                            Required if you want the depot to automatically pull your stats.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                            Shard
                        </label>
                        <select
                            value={shard}
                            onChange={e => setShard(e.target.value)}
                            className="w-full rounded-lg px-4 py-2 text-sm outline-none transition-all cursor-pointer"
                            style={{
                                backgroundColor: "var(--bg-input)",
                                border: "1px solid var(--border)",
                                color: "var(--text-primary)",
                            }}
                        >
                            <option value="shard0">shard0</option>
                            <option value="shard1">shard1</option>
                            <option value="shard2">shard2</option>
                            <option value="shard3">shard3</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                        <input
                            type="checkbox"
                            id="polling-toggle"
                            checked={pollingEnabled}
                            onChange={e => setPollingEnabled(e.target.checked)}
                            className="w-4 h-4 cursor-pointer rounded"
                            style={{ accentColor: "var(--accent)", backgroundColor: "var(--bg-input)", border: "1px solid var(--border)" }}
                        />
                        <label htmlFor="polling-toggle" className="text-sm cursor-pointer select-none" style={{ color: "var(--text-primary)" }}>
                            Enable Background Polling
                        </label>
                    </div>

                    {isEdit && server && (
                        <div className="pt-4 mt-4 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
                            <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                                🔌 API / MCP Access
                            </p>

                            {/* Server ID */}
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                                    Server ID
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={server.id}
                                        className="w-full rounded-lg px-3 py-1.5 text-xs font-mono outline-none"
                                        style={{
                                            backgroundColor: "var(--bg-input)",
                                            border: "1px solid var(--border)",
                                            color: "var(--text-muted)",
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => { navigator.clipboard.writeText(server.id); }}
                                        className="px-2.5 py-1.5 text-xs rounded-lg cursor-pointer transition-colors shrink-0"
                                        style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--border)"}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = "var(--bg-secondary)"}
                                        title="Copy Server ID"
                                    >
                                        📋
                                    </button>
                                </div>
                            </div>

                            {/* Push Token / API Key */}
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                                    API Key <span style={{ color: "var(--text-muted)" }}>(Push Token)</span>
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={server.pushToken}
                                        className="w-full rounded-lg px-3 py-1.5 text-xs font-mono outline-none"
                                        style={{
                                            backgroundColor: "var(--bg-input)",
                                            border: "1px solid var(--border)",
                                            color: "var(--text-muted)",
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => { navigator.clipboard.writeText(server.pushToken); }}
                                        className="px-2.5 py-1.5 text-xs rounded-lg cursor-pointer transition-colors shrink-0"
                                        style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--border)"}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = "var(--bg-secondary)"}
                                        title="Copy API Key"
                                    >
                                        📋
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRegenerate}
                                        disabled={isSaving}
                                        className="px-2.5 py-1.5 text-xs rounded-lg cursor-pointer transition-colors shrink-0"
                                        style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--warning)" }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--border)"}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = "var(--bg-secondary)"}
                                        title="Regenerate API Key"
                                    >
                                        🔄
                                    </button>
                                </div>
                                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                                    Use as <code style={{ color: "var(--accent)" }}>X-API-Key</code> header or <code style={{ color: "var(--accent)" }}>X-Push-Token</code> header.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between pt-6 mt-2">
                        {isEdit ? (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isSaving}
                                className="px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                                style={{ color: "var(--error)", backgroundColor: "rgba(239, 68, 68, 0.1)" }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.2)"}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.1)"}
                            >
                                Delete
                            </button>
                        ) : (
                            <div></div>
                        )}
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSaving}
                                className="px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                                style={{ color: "var(--text-primary)", backgroundColor: "var(--bg-secondary)" }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--border)"}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = "var(--bg-secondary)"}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50"
                                style={{ color: "#fff", backgroundColor: "var(--accent)" }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--accent-hover)"}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = "var(--accent)"}
                            >
                                {isSaving ? "Saving..." : "Save Server"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
