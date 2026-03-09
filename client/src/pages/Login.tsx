import { useState, type FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";

export default function Login() {
    const { login, register, error, clearError, isLoading } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isRegister, setIsRegister] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        try {
            if (isRegister) {
                await register(username, password);
            } else {
                await login(username, password);
            }
        } catch {
            // error is set in the auth hook
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
            <button
                onClick={toggleTheme}
                className="absolute top-6 right-6 z-50 glass-panel-interactive rounded-full w-12 h-12 flex items-center justify-center text-xl cursor-pointer transition-all hover:scale-110"
                style={{ color: "var(--text-primary)" }}
                title="Toggle Theme"
            >
                {theme === "light" ? "🌙" : "☀️"}
            </button>

            {/* Ambient Background Glows */}
            <div className="absolute w-[600px] h-[600px] bg-[var(--accent)]/10 rounded-full blur-[120px] -top-32 -left-32 pointer-events-none mix-blend-screen"></div>
            <div className="absolute w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] bottom-0 right-0 pointer-events-none mix-blend-screen"></div>

            <div className="w-full max-w-md rounded-2xl p-10 glass-panel relative z-10 shadow-2xl shadow-[var(--bg-base)]">
                {/* Subtle top border highlight */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-60"></div>

                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold mb-3 flex items-center justify-center gap-3 text-glow">
                        <span className="text-[var(--accent)]">✨</span>
                        <span className="text-[var(--text-primary)]">Screeps Depot</span>
                    </h1>
                    <p className="text-[var(--text-secondary)] font-medium text-sm">
                        {isRegister ? "Claim your empire's new dashboard" : "Welcome back to your command center"}
                    </p>
                </div>

                {/* Error banner */}
                {error && (
                    <div className="rounded-xl px-4 py-3 mb-6 text-sm flex items-center justify-between border border-[var(--error)] bg-red-500/10 text-[var(--error)] shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                        <span>{error}</span>
                        <button
                            onClick={clearError}
                            className="ml-2 hover:opacity-70 transition-opacity cursor-pointer p-1"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">
                            Username
                        </label>
                        <input
                            id="login-username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all glass-panel-interactive text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent)]/50 focus:border-[var(--accent)] placeholder:text-[var(--text-muted)] bg-[var(--bg-card)]"
                            placeholder="Enter your username"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">
                            Password
                        </label>
                        <input
                            id="login-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all glass-panel-interactive text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent)]/50 focus:border-[var(--accent)] placeholder:text-[var(--text-muted)] bg-[var(--bg-card)]"
                            placeholder="Enter your password"
                        />
                    </div>

                    <button
                        id="login-submit"
                        type="submit"
                        disabled={isLoading}
                        className="w-full rounded-xl mt-4 px-4 py-3 text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] shadow-lg shadow-[var(--accent-glow)] hover:shadow-xl hover:shadow-[var(--accent-glow)] hover:-translate-y-0.5"
                    >
                        {isLoading
                            ? "Authenticating..."
                            : isRegister
                                ? "Create Account"
                                : "Sign In ✨"}
                    </button>
                </form>

                {/* Toggle register/login */}
                <p className="text-center text-sm mt-8 text-[var(--text-muted)] border-t border-[var(--border-light)] pt-6">
                    {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
                    <button
                        id="toggle-auth-mode"
                        onClick={() => {
                            setIsRegister(!isRegister);
                            clearError();
                        }}
                        className="font-medium hover:text-[var(--accent-hover)] transition-colors cursor-pointer text-[var(--accent)]"
                    >
                        {isRegister ? "Sign in" : "Register"}
                    </button>
                </p>
            </div>
        </div>
    );
}
