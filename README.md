# ScreepsDepot 🚂

![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)
![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)
![Deployment](https://img.shields.io/badge/Deploy-Railway-black.svg)
![Status](https://img.shields.io/badge/Status-In_Development-yellow.svg)

**ScreepsDepot** is a centralized, multi-tenant telemetry and log storage hub for your Screeps AI. It acts as a data warehousing backend, going beyond standard in-game memory limits by offloading your stats, logs, and metrics to a secure external depot.

Whether you're running code on the MMO World, competing in the latest Season, or testing on a Private Server, ScreepsDepot keeps all your telemetry organized, searchable, and ready for visualization.

---

## ✨ Features

* **Multi-Tenant Architecture:** Secure login and user management allowing multiple players/users to isolate and manage their own data independently.
* **Grafana-Ready Telemetry:** Automatically parses and structures your game stats (room energy, creep counts, GCL, CPU usage, etc.) making it a robust, plug-and-play data source for Grafana dashboards.
* **Persistent Log Archiving:** Captures your in-game console logs and stores them indefinitely. Stop losing historical debugging data to the terminal scroll limit.
* **Omni-Server Context:** Manage multiple Screeps environments under one roof. Easily tag and filter data between Screeps World, Screeps Seasons, and custom Private Servers.
* **Dual-Mode Ingestion:** * **Pull Mode:** Provide your Screeps API Token/Credentials, and the Depot will automatically scrape your stats on a scheduled interval.
    * **Push Mode:** Use the Depot's ingestion API to `POST` telemetry and logs directly from an in-game agent or external script.

---

## 🏗️ Architecture & Stack

* **Language:** Python (Powered by `antigravity`)
* **Database:** PostgreSQL (Ideal for time-series data and relational user management)
* **Deployment:** Designed to be easily hosted on [Railway.app](https://railway.app)
* **Visualization:** Compatible with Grafana

---

## 🚀 Getting Started

### 1. Local Development

Clone the repository and install the dependencies:

```bash
git clone [https://github.com/](https://github.com/)<your-username>/screepsdepot.git
cd screepsdepot
pip install -r requirements.txt
```
Set up your local .env file with your database credentials:

```bash
DATABASE_URL=postgres://user:password@localhost:5432/screepsdepot
SECRET_KEY=your_super_secret_key
```

Run the application.

```bash
# Add your specific run command here, e.g., uvicorn, gunicorn, python app.py
```

### 2. Deploying to Railway
ScreepsDepot is built for easy deployment on Railway:

Fork or clone this repository to your GitHub account.

Create a new Project in Railway and select Deploy from GitHub repo.

Add a PostgreSQL plugin to your Railway project.

Ensure the DATABASE_URL environment variable is linked to your app service.

Railway will automatically detect the Python environment and deploy!

## 🔌 API Integration (Push Mode)
More detailed API documentation coming soon.

To push data directly from your Screeps AI, you will generate an API Key in the ScreepsDepot dashboard. You can then configure your in-game code to send a POST request to the ingestion endpoint:

```javascript
// Example Screeps Agent Push
const DEPOT_URL = "[https://your-app-name.up.railway.app/api/v1/ingest](https://your-app-name.up.railway.app/api/v1/ingest)";
const API_KEY = "your_depot_api_key";

// ... collect stats ...

Game.market.calcTransactionCost(...) // etc.
```
## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

## 📝 License

This project is licensed under the GNU Affero General Public License v3.0 (AGPLv3) - see the [LICENSE](LICENSE) file for details.