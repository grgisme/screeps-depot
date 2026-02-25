import { Router, Request, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";

const router = Router();

// All routes in this file require authentication
router.use(authenticate);

// ─── GET /api/servers ────────────────────────────────────────────────────────
// List all servers for the authenticated user.
router.get("/", async (req: AuthRequest, res: Response) => {
    try {
        const servers = await prisma.screepsServer.findMany({
            where: { userId: req.userId! },
            orderBy: { createdAt: "desc" },
        });
        res.json(servers);
    } catch (err) {
        console.error("List servers error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ─── POST /api/servers ───────────────────────────────────────────────────────
// Create a new Screeps server entry.
router.post("/", async (req: AuthRequest, res: Response) => {
    try {
        const { name, apiToken } = req.body;

        if (!name) {
            res.status(400).json({ error: "Server name is required" });
            return;
        }

        const server = await prisma.screepsServer.create({
            data: {
                name,
                apiToken: apiToken || null,
                userId: req.userId!,
            },
        });
        res.status(201).json(server);
    } catch (err) {
        console.error("Create server error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ─── GET /api/servers/:id ────────────────────────────────────────────────────
// Get a single server by ID (must belong to the authenticated user).
router.get("/:id", async (req: Request<{ id: string }>, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as AuthRequest).userId!;
        const server = await prisma.screepsServer.findFirst({
            where: { id, userId },
        });

        if (!server) {
            res.status(404).json({ error: "Server not found" });
            return;
        }

        res.json(server);
    } catch (err) {
        console.error("Get server error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ─── DELETE /api/servers/:id ─────────────────────────────────────────────────
// Delete a server (cascades to stats and logs).
router.delete("/:id", async (req: Request<{ id: string }>, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as AuthRequest).userId!;
        // Verify ownership first
        const server = await prisma.screepsServer.findFirst({
            where: { id, userId },
        });

        if (!server) {
            res.status(404).json({ error: "Server not found" });
            return;
        }

        await prisma.screepsServer.delete({ where: { id } });
        res.status(204).send();
    } catch (err) {
        console.error("Delete server error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
