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

    const inputClasses = "w-full bg-white/5 border border-[var(--border-light)] rounded-lg px-4 py-2.5 text-sm outline-none focus:border-indigo-500 transition-colors text-[var(--text-primary)] placeholder:text-[var(--text-muted)]";

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[var(--bg-base)] border border-[var(--border-light)] rounded-2xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-outfit font-bold text-[var(--text-primary)]">
                        {isEdit ? "Edit Server Settings" : "Add New Server"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-xl leading-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                        &times;
                    </button>
                </div>

                {error && (
                    <div className="rounded-lg px-4 py-3 mb-4 text-sm flex items-center justify-between border border-[var(--error)] bg-red-500/10 text-[var(--error)]">
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="ml-2 hover:opacity-70 cursor-pointer">✕</button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-[var(--text-secondary)]">
                            Server Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                            placeholder="e.g. MMO, Season 8, Localhost"
                            className={inputClasses}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-[var(--text-secondary)]">
                            API Base URL
                        </label>
                        <input
                            type="url"
                            value={apiBaseUrl}
                            onChange={e => setApiBaseUrl(e.target.value)}
                            required
                            className={inputClasses}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-[var(--text-secondary)]">
                            Screeps API Token
                        </label>
                        <input
                            type="password"
                            value={apiToken}
                            onChange={e => setApiToken(e.target.value)}
                            placeholder="Optional: Used for Pull Mode"
                            className={inputClasses}
                        />
                        <p className="text-xs mt-1 text-[var(--text-muted)]">
                            Required if you want the depot to automatically pull your stats.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-[var(--text-secondary)]">
                            Shard
                        </label>
                        <select
                            value={shard}
                            onChange={e => setShard(e.target.value)}
                            className={`${inputClasses} cursor-pointer`}
                        >
                            <option value="shard0">shard0</option>
                            <option value="shard1">shard1</option>
                            <option value="shard2">shard2</option>
                            <option value="shard3">shard3</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="polling-toggle"
                            checked={pollingEnabled}
                            onChange={e => setPollingEnabled(e.target.checked)}
                            className="w-4 h-4 cursor-pointer rounded"
                            style={{ accentColor: "var(--accent)" }}
                        />
                        <label htmlFor="polling-toggle" className="text-sm cursor-pointer select-none text-[var(--text-primary)]">
                            Enable Background Polling
                        </label>
                    </div>

                    {isEdit && server && (
                        <div className="pt-4 mt-2 space-y-3 border-t border-[var(--border-light)]">
                            <p className="text-xs font-semibold text-[var(--text-muted)]">
                                🔌 API / MCP Access
                            </p>

                            {/* Server ID */}
                            <div>
                                <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
                                    Server ID
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={server.id}
                                        className="w-full bg-white/5 border border-[var(--border-light)] rounded-lg px-3 py-1.5 text-xs font-mono outline-none text-[var(--text-muted)]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => { navigator.clipboard.writeText(server.id); }}
                                        className="px-2.5 py-1.5 text-xs rounded-lg cursor-pointer transition-colors shrink-0 border border-[var(--border-light)] bg-white/5 text-[var(--text-primary)] hover:bg-white/10"
                                        title="Copy Server ID"
                                    >
                                        📋
                                    </button>
                                </div>
                            </div>

                            {/* Push Token / API Key */}
                            <div>
                                <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
                                    API Key <span className="text-[var(--text-muted)]">(Push Token)</span>
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={server.pushToken}
                                        className="w-full bg-white/5 border border-[var(--border-light)] rounded-lg px-3 py-1.5 text-xs font-mono outline-none text-[var(--text-muted)]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => { navigator.clipboard.writeText(server.pushToken); }}
                                        className="px-2.5 py-1.5 text-xs rounded-lg cursor-pointer transition-colors shrink-0 border border-[var(--border-light)] bg-white/5 text-[var(--text-primary)] hover:bg-white/10"
                                        title="Copy API Key"
                                    >
                                        📋
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRegenerate}
                                        disabled={isSaving}
                                        className="px-2.5 py-1.5 text-xs rounded-lg cursor-pointer transition-colors shrink-0 border border-[var(--border-light)] bg-white/5 text-[var(--warning)] hover:bg-white/10"
                                        title="Regenerate API Key"
                                    >
                                        🔄
                                    </button>
                                </div>
                                <p className="text-xs mt-1 text-[var(--text-muted)]">
                                    Use as <code className="text-[var(--accent)]">X-API-Key</code> header or <code className="text-[var(--accent)]">X-Push-Token</code> header.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between mt-6">
                        {isEdit ? (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isSaving}
                                className="px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors text-[var(--error)] bg-red-500/10 hover:bg-red-500/20"
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
                                className="px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors text-[var(--text-primary)] bg-white/5 hover:bg-white/10 border border-[var(--border-light)]"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50 text-white bg-indigo-500 hover:bg-indigo-400 shadow-lg shadow-indigo-500/30"
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
