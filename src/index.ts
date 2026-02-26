import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables before anything else
dotenv.config();

import authRoutes from "./routes/auth.js";
import serverRoutes from "./routes/servers.js";
import pushRoutes from "./routes/push.js";
import grafanaRoutes from "./routes/grafana.js";
import dashboardRoutes from "./routes/dashboard.js";
import { startPoller } from "./services/poller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/servers", serverRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/grafana", grafanaRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Static Frontend ─────────────────────────────────────────────────────────
// Serve the built React app from client/dist in production
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));

// SPA fallback: any non-API route serves the React app's index.html
app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"), (err) => {
        if (err) {
            // In dev mode, the client/dist might not exist — return API info
            res.json({
                name: "Screeps Depot",
                version: "1.0.0",
                note: "Frontend not built. Run 'npm run build' in client/ or use 'npm run dev' for Vite dev server.",
                endpoints: {
                    health: "/api/health",
                    auth: "/api/auth",
                    servers: "/api/servers",
                    pushStats: "/api/push/stats",
                    pushLogs: "/api/push/logs",
                },
            });
        }
    });
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀 Screeps Depot server running on http://localhost:${PORT}`);

    // Start the background polling service
    startPoller();
});

export default app;
