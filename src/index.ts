import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables before anything else
dotenv.config();

import authRoutes from "./routes/auth";
import serverRoutes from "./routes/servers";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/servers", serverRoutes);

// ─── Health Check ────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀 Screeps Depot server running on http://localhost:${PORT}`);
});

export default app;
