import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

const router = Router();

const SALT_ROUNDS = 10;

/** Generate a JWT for a given user ID. */
function generateToken(userId: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not configured");
    }
    return jwt.sign({ userId }, secret, { expiresIn: "7d" });
}

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post("/register", async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            res.status(400).json({ error: "Username and password are required" });
            return;
        }

        if (password.length < 6) {
            res
                .status(400)
                .json({ error: "Password must be at least 6 characters" });
            return;
        }

        // Check if username already exists
        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) {
            res.status(409).json({ error: "Username already taken" });
            return;
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const user = await prisma.user.create({
            data: { username, passwordHash },
        });

        const token = generateToken(user.id);
        res.status(201).json({ token, userId: user.id });
    } catch (err) {
        console.error("Register error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post("/login", async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            res.status(400).json({ error: "Username and password are required" });
            return;
        }

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }

        const token = generateToken(user.id);
        res.json({ token, userId: user.id });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
