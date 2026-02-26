import { useState, type FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
    const { login, register, error, clearError, isLoading } = useAuth();
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
        <div className="min-h-screen flex items-center justify-center px-4">
            <div
                className="w-full max-w-md rounded-2xl p-8"
                style={{
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                }}
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <h1
                        className="text-3xl font-bold mb-2"
                        style={{ color: "var(--text-primary)" }}
                    >
                        🏗️ Screeps Depot
                    </h1>
                    <p style={{ color: "var(--text-secondary)" }}>
                        {isRegister ? "Create your account" : "Sign in to your dashboard"}
                    </p>
                </div>

                {/* Error banner */}
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
                        <button
                            onClick={clearError}
                            className="ml-2 hover:opacity-70 cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label
                            className="block text-sm font-medium mb-1.5"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            Username
                        </label>
                        <input
                            id="login-username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-all"
                            style={{
                                backgroundColor: "var(--bg-input)",
                                border: "1px solid var(--border)",
                                color: "var(--text-primary)",
                            }}
                            onFocus={(e) =>
                                (e.target.style.borderColor = "var(--border-focus)")
                            }
                            onBlur={(e) =>
                                (e.target.style.borderColor = "var(--border)")
                            }
                            placeholder="Enter your username"
                        />
                    </div>

                    <div>
                        <label
                            className="block text-sm font-medium mb-1.5"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            Password
                        </label>
                        <input
                            id="login-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-all"
                            style={{
                                backgroundColor: "var(--bg-input)",
                                border: "1px solid var(--border)",
                                color: "var(--text-primary)",
                            }}
                            onFocus={(e) =>
                                (e.target.style.borderColor = "var(--border-focus)")
                            }
                            onBlur={(e) =>
                                (e.target.style.borderColor = "var(--border)")
                            }
                            placeholder="Enter your password"
                        />
                    </div>

                    <button
                        id="login-submit"
                        type="submit"
                        disabled={isLoading}
                        className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                            backgroundColor: "var(--accent)",
                            color: "#fff",
                        }}
                        onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                            "var(--accent-hover)")
                        }
                        onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor = "var(--accent)")
                        }
                    >
                        {isLoading
                            ? "Please wait..."
                            : isRegister
                                ? "Create Account"
                                : "Sign In"}
                    </button>
                </form>

                {/* Toggle register/login */}
                <p
                    className="text-center text-sm mt-6"
                    style={{ color: "var(--text-muted)" }}
                >
                    {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
                    <button
                        id="toggle-auth-mode"
                        onClick={() => {
                            setIsRegister(!isRegister);
                            clearError();
                        }}
                        className="font-medium hover:underline cursor-pointer"
                        style={{ color: "var(--accent)" }}
                    >
                        {isRegister ? "Sign in" : "Register"}
                    </button>
                </p>
            </div>
        </div>
    );
}
