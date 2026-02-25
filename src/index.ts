import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables before anything else
dotenv.config();

import authRoutes from "./routes/auth.js";
import serverRoutes from "./routes/servers.js";
import pushRoutes from "./routes/push.js";
import { startPoller } from "./services/poller.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/servers", serverRoutes);
app.use("/api/push", pushRoutes);

// ─── Root ────────────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
    res.json({
        name: "Screeps Depot",
        version: "1.0.0",
        endpoints: {
            health: "/api/health",
            auth: "/api/auth",
            servers: "/api/servers",
            pushStats: "/api/push/stats",
            pushLogs: "/api/push/logs",
        },
    });
});

// ─── Health Check ────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀 Screeps Depot server running on http://localhost:${PORT}`);

    // Start the background polling service
    startPoller();
});

export default app;
