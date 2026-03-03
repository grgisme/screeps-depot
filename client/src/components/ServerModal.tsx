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
                await updateServer(token, server.id, { name, apiToken, apiBaseUrl, pollingEnabled });
            } else {
                await createServer(token, { name, apiToken, apiBaseUrl, pollingEnabled });
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
                className="w-full max-w-md rounded-xl p-6 shadow-xl"
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

                <form onSubmit={handleSubmit} className="space-y-4">
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
                        <div className="pt-4 mt-4" style={{ borderTop: "1px solid var(--border)" }}>
                            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                                Push Token
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={server.pushToken}
                                    className="w-full rounded-lg px-4 py-2 text-sm outline-none opacity-80"
                                    style={{
                                        backgroundColor: "var(--bg-input)",
                                        border: "1px solid var(--border)",
                                        color: "var(--text-muted)",
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={handleRegenerate}
                                    disabled={isSaving}
                                    className="px-3 py-2 text-xs rounded-lg cursor-pointer transition-colors"
                                    style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--border)"}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "var(--bg-secondary)"}
                                >
                                    Regenerate
                                </button>
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
