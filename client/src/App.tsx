import { AuthProvider, useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

function AppContent() {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-pulse text-[var(--text-secondary)] text-lg font-outfit font-semibold">
                    Loading...
                </div>
            </div>
        );
    }

    return isAuthenticated ? <Dashboard /> : <Login />;
}

export default function App() {
    return (
        <AuthProvider>
            {/* Ambient background blurred gradients */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
                <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-indigo-500/20 blur-[100px]" />
                <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-violet-500/20 blur-[100px]" />
            </div>
            <div className="relative z-10">
                <AppContent />
            </div>
        </AuthProvider>
    );
}
