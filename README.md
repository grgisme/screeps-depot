# ScreepsDepot 🚂

![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)
![Node](https://img.shields.io/badge/Node-%E2%89%A522-green.svg)
![Deployment](https://img.shields.io/badge/Deploy-Railway-black.svg)
![Status](https://img.shields.io/badge/Status-In_Development-yellow.svg)

**ScreepsDepot** is a centralized, multi-tenant telemetry and observability hub for your Screeps AI. It goes beyond standard in-game memory limits by offloading your stats, logs, and flight recorder events to a secure external depot with a real-time dashboard.

Whether you're running code on the MMO World, competing in the latest Season, or testing on a Private Server, ScreepsDepot keeps all your telemetry organized, searchable, and visualized in one place.

---

## ✨ Features

* **Multi-Tenant Architecture:** Secure user registration and login with JWT authentication. Each player manages their own data in full isolation.
* **Real-Time Observability Dashboard:** A tabbed React SPA with views for:
    * **Overview** — high-level colony health at a glance
    * **Performance** — per-tick CPU, GCL, energy, and creep stats (Recharts)
    * **Flight Recorder** — structured event logs from in-game FlightRecorder (segments 98/99)
    * **Rooms** — room-level telemetry
    * **Market** — market activity data
    * **System Logs** — console log archive with severity filtering
* **Per-Tick Stats Ingestion:** Parses segment 97 (StatsExporter) data into structured, queryable time-series records.
* **Persistent Log Archiving:** Captures in-game console output and stores it indefinitely.
* **Multi-Server Support:** Manage multiple Screeps environments (World, Seasons, Private Servers) under one account with per-server configuration.
* **Dual-Mode Ingestion:**
    * **Pull Mode:** Provide your Screeps API token, and the Depot automatically polls your memory segments and console on a configurable multi-cadence schedule.
    * **Push Mode:** Use the Depot's ingestion API to `POST` telemetry and logs directly from an in-game agent.
* **Grafana-Compatible:** JSON datasource endpoints for plugging directly into Grafana dashboards.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js ≥22 (ESM) |
| Server | TypeScript + Express 5 |
| Client | React 19 + Vite + Tailwind CSS 4 + Recharts |
| ORM / Database | Prisma 7 → PostgreSQL |
| Auth | bcryptjs + jsonwebtoken (JWT) |
| Background Jobs | node-cron (multi-cadence poller) |
| Deployment | Railway.app |

---

## 🚀 Getting Started

### Prerequisites
* Node.js ≥22
* PostgreSQL instance (local or hosted)

### 1. Clone & Install

```powershell
git clone https://github.com/<your-username>/screeps-depot.git
cd screeps-depot
npm install
```

### 2. Configure Environment

Create a `.env` file in the repo root:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/screepsdepot
JWT_SECRET=your_super_secret_key
PORT=3000
```

### 3. Set Up the Database

```powershell
npx prisma migrate dev
```

### 4. Run in Development

Start the server (with hot-reload):
```powershell
npm run dev
```

In a separate terminal, start the client dev server:
```powershell
cd client
npm install
npm run dev
```

### 5. Production Build

```powershell
npm run build
npm start
```

This installs client dependencies, builds the React SPA, generates the Prisma client, and type-checks the server. `npm start` runs migrations and starts the Express server, which serves the built SPA from `client/dist/`.

---

## 🖥️ Deploying to Railway

1. Fork or clone this repository to your GitHub account.
2. Create a new Project in Railway and select **Deploy from GitHub repo**.
3. Add a **PostgreSQL** plugin to your Railway project.
4. Set the `DATABASE_URL` and `JWT_SECRET` environment variables on the app service.
5. Railway will build and deploy automatically.

---

## 🔌 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `POST /api/auth/register` | Register a new user |
| `POST /api/auth/login` | Login and receive JWT |
| `GET/POST /api/servers` | CRUD for Screeps server configurations |
| `POST /api/push/stats` | Push stats from in-game agent (token auth) |
| `POST /api/push/logs` | Push logs from in-game agent (token auth) |
| `GET /api/dashboard/*` | Dashboard data queries |
| `GET /api/tick-stats/*` | Per-tick stats queries |
| `GET /api/flight-recorder/*` | Flight recorder event queries |
| `GET /api/grafana/*` | Grafana JSON datasource |

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues](../../issues) page.

## 📝 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPLv3)** — see the [LICENSE](LICENSE) file for details.