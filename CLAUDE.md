# ScreepsDepot - AI Developer Guidelines

## 📌 Project Context
ScreepsDepot is a multi-tenant, Python-powered telemetry and log storage backend for the programming MMO game **Screeps**. It is designed to be hosted on Railway.app. 

Its primary goals are to:
1. Provide long-term persistent storage for Screeps console logs.
2. Store game stats/telemetry for external visualization (Grafana).
3. Support multiple users (multi-tenancy) and multiple game instances per user (Screeps World, Seasons, Private Servers).
4. Ingest data via two modes: **Push** (in-game agents posting to our API) and **Pull** (background workers scraping data using user-provided Screeps API tokens).

## 🛠️ Tech Stack
* **Language:** Python 3.10+
* **Database:** PostgreSQL (Time-series data and relational storage)
* **Hosting:** Railway.app
* **License:** GNU AGPLv3 (Do NOT introduce dependencies with incompatible licenses).

## 🏗️ Architectural Rules & Constraints

### 1. Multi-Tenancy & Data Isolation (CRITICAL)
* Every piece of user-generated data (logs, stats, server configs, credentials) MUST be tied to a `user_id` or `tenant_id`.
* Every database query must explicitly filter by the user context to prevent data leakage between players.
* Users can have multiple `Server` contexts (e.g., MMO, Season 8, LocalHost). Telemetry and logs must be linked to both a `user_id` and a `server_id`.

### 2. Dual-Mode Ingestion Logic
* **Push API:** Endpoints must be lightweight and fast to handle high-frequency `POST` requests from Screeps agents. Authentication should be handled via fast API keys/tokens.
* **Pull Worker:** Background tasks (e.g., Celery, APScheduler, or native async tasks) must handle rate-limiting aggressively. The Screeps official API restricts polling frequency; the scheduler must respect these limits to prevent IP bans.

### 3. Database Interactions
* Use connection pooling. Railway deployments can quickly exhaust standard Postgres connections if polling workers and web threads aren't sharing a pool.
* Time-series data (stats) and heavy text data (logs) will grow exponentially. Index heavily queried fields like `timestamp`, `user_id`, and `server_id`.
* Do not log or print sensitive user credentials or Screeps API tokens in plain text. Tokens must be encrypted at rest if stored in the database.

## 💻 Coding Standards

### Python Conventions
* **Type Hinting:** Strictly use Python type hints for all function signatures and return types.
* **Format:** Adhere to PEP 8 standards. Use `black` or `ruff` for formatting if configuring pipelines.
* **Async:** Utilize `async`/`await` patterns for external HTTP requests (scraping Screeps API) and database calls to keep the application highly concurrent.

### Error Handling & Logging
* Fail gracefully. If the Screeps API is down or rate-limiting us, the pull worker should back off exponentially, not crash.
* Push API endpoints should return clear `4xx` errors for bad agent payloads and `401` for invalid API keys.

## 🚀 Deployment (Railway)
* Rely on environment variables (e.g., `.env`) for all configuration (`DATABASE_URL`, `SECRET_KEY`, `PORT`).
* Ensure migrations are run automatically on startup or deployment before the main web server process accepts connections.