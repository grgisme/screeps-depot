# ScreepsDepot — AI Developer Guidelines

> **[CONTEXT DIRECTORY]** If you need deep architectural or mechanical details regarding the Screeps engine logic being observed, read these files completely before assuming behavior:
> - `/home/grgisme/code/tickforge/docs/screeps_game_reference.md` (Game mechanics, execution limits, intent queues)
> - `/home/grgisme/code/tickforge/docs/tickforge_ai_reference.md` (TickForge engine, architecture, state flow)
> - `/home/grgisme/code/tickforge/docs/test_pipeline_reference.md` (Scenarios, JSON logic, ladder CLI pipelines)
> - `/home/grgisme/code/screepulous/docs/screepulous_ai_reference.md` (Bot WODE paradigm, OS execution, Hatchery)

## 📌 Project Context
ScreepsDepot is a multi-tenant telemetry, observability, and log storage hub for the programming MMO game **Screeps**. It is designed to be hosted on Railway.app.

Its primary goals are to:
1. Provide long-term persistent storage for Screeps console logs.
2. Ingest and store per-tick game stats/telemetry (segment 97), Flight Recorder events (segments 98/99), and console output.
3. Expose a real-time observability dashboard with performance, flight recorder, room, market, and system log tabs.
4. Support multiple users (multi-tenancy) and multiple game instances per user (Screeps World, Seasons, Private Servers).
5. Ingest data via two modes: **Push** (in-game agents POST-ing to the API) and **Pull** (background poller scraping data using user-provided Screeps API tokens).

## 🛠️ Tech Stack
* **Runtime:** Node.js ≥22 (ESM)
* **Server:** TypeScript + Express 5
* **Client:** React 19 + Vite + Tailwind CSS 4 + Recharts
* **ORM / DB:** Prisma 7 → PostgreSQL
* **Auth:** bcryptjs + jsonwebtoken (JWT)
* **Background:** `node-cron` scheduler driving a multi-cadence poller
* **Hosting:** Railway.app
* **License:** GNU AGPLv3 — Do NOT introduce dependencies with incompatible licenses.

## 🏗️ Architectural Rules & Constraints

### 1. Multi-Tenancy & Data Isolation (CRITICAL)
* Every piece of user-generated data (logs, stats, server configs, credentials) MUST be tied to a `userId`.
* Every database query must explicitly filter by the user context to prevent data leakage between players.
* Users can have multiple `ScreepsServer` contexts (e.g., MMO, Season 8, LocalHost). All telemetry and logs are linked to both a `userId` and a `serverId`.

### 2. Dual-Mode Ingestion
* **Push API (`/api/push`):** Lightweight endpoints accepting high-frequency `POST` requests from Screeps agents. Authenticated via static `pushToken` per server.
* **Pull Poller (`src/services/poller.ts`):** A cron-based background service that polls the Screeps API (segments 97/98/99 + console) on configurable cadences per server. Must respect Screeps API rate limits to prevent IP bans.

### 3. Database Interactions
* Use Prisma with PostgreSQL. The Prisma schema lives at `prisma/schema.prisma` and the generated client is output to `src/generated/prisma/`.
* Time-series data (stats, tick stats, flight recorder entries) grows rapidly. Heavily-indexed fields include `tick`, `recordedAt`, `serverId`, and `severity`.
* Do not log or print sensitive user credentials or Screeps API tokens in plain text.

### 4. Project Layout
```
screeps-depot/
├── src/                  # Express server (TypeScript)
│   ├── index.ts          # App entry point, routes, static serving
│   ├── routes/           # API route handlers
│   │   ├── auth.ts       # /api/auth — register, login, JWT
│   │   ├── servers.ts    # /api/servers — CRUD for ScreepsServer
│   │   ├── push.ts       # /api/push — push-mode ingestion
│   │   ├── grafana.ts    # /api/grafana — Grafana JSON datasource
│   │   ├── dashboard.ts  # /api/dashboard — dashboard data
│   │   ├── tickStats.ts  # /api/tick-stats — per-tick stats
│   │   └── flightRecorder.ts  # /api/flight-recorder — FR events
│   ├── services/
│   │   ├── poller.ts     # Background multi-cadence polling
│   │   └── screepsApi.ts # Screeps API client
│   ├── middleware/        # Auth middleware
│   └── generated/prisma/ # Prisma-generated client (git-ignored)
├── client/               # React SPA (Vite)
│   └── src/
│       ├── pages/        # Dashboard, Login, tab pages
│       └── components/   # Reusable UI components
├── prisma/
│   └── schema.prisma     # Database schema
└── .agents/workflows/    # Automation workflows (see below)
```

## 💻 Coding Standards

### TypeScript Conventions
* **Strict types:** Use TypeScript types/interfaces for all function signatures, API payloads, and return values.
* **ESM:** The project uses ES Modules (`"type": "module"` in `package.json`). Use `.js` extensions in import paths.
* **Async:** Use `async`/`await` for all I/O (database, HTTP, file system).

### Error Handling
* Fail gracefully. If the Screeps API is down or rate-limiting, the poller should back off, not crash.
* Push API endpoints should return clear `4xx` errors for bad payloads and `401` for invalid tokens.

## � PowerShell Terminal Rules
* ALWAYS use PowerShell.
* NEVER append `2>&1`, `2>$null`, or other redirection pipes to commands — this causes terminal deadlocks.
* NEVER chain commands using semicolons (`;`), `&&`, or inline logic. Run one simple, single command at a time.
* ALWAYS execute commands directly (e.g., exactly `npm run build`) without wrapping them in interactive shells or custom error-handling wrappers.

## 🔁 Workflows
When validating, building, or testing, **always use the provided workflows** instead of manually issuing commands. This ensures correct execution order without requiring user input.

| Task | Slash Command |
|------|---------------|
| Type-check only (server + client) | `/test` |
| Full production build (client + prisma + server) | `/build` |
| Type-check **and** build | `/validate` |
| Validate, then commit & push | `/validate-and-sync` |
| Commit & push (no validation) | `/git-sync` |

## 🚀 Deployment (Railway)
* All configuration via environment variables (`.env`): `DATABASE_URL`, `JWT_SECRET`, `PORT`.
* Prisma migrations run on startup via `prisma migrate deploy` (defined in the `start` script).
* The built React SPA is served as static files from `client/dist/` by the Express server.