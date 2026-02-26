import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    type ReactNode,
} from "react";
import { login as apiLogin, register as apiRegister } from "../lib/api";

interface AuthState {
    token: string | null;
    userId: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string) => Promise<void>;
    logout: () => void;
    clearError: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = "screeps_depot_token";
const USER_KEY = "screeps_depot_userId";

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Restore token from localStorage on mount
    useEffect(() => {
        const savedToken = localStorage.getItem(TOKEN_KEY);
        const savedUser = localStorage.getItem(USER_KEY);
        if (savedToken && savedUser) {
            setToken(savedToken);
            setUserId(savedUser);
        }
        setIsLoading(false);
    }, []);

    const login = useCallback(async (username: string, password: string) => {
        setError(null);
        setIsLoading(true);
        try {
            const res = await apiLogin(username, password);
            setToken(res.token);
            setUserId(res.userId);
            localStorage.setItem(TOKEN_KEY, res.token);
            localStorage.setItem(USER_KEY, res.userId);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const register = useCallback(async (username: string, password: string) => {
        setError(null);
        setIsLoading(true);
        try {
            const res = await apiRegister(username, password);
            setToken(res.token);
            setUserId(res.userId);
            localStorage.setItem(TOKEN_KEY, res.token);
            localStorage.setItem(USER_KEY, res.userId);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Registration failed");
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const logout = useCallback(() => {
        setToken(null);
        setUserId(null);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }, []);

    const clearError = useCallback(() => setError(null), []);

    return (
        <AuthContext.Provider
            value={{
                token,
                userId,
                isAuthenticated: !!token,
                isLoading,
                error,
                login,
                register,
                logout,
                clearError,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
}
