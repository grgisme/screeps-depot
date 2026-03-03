# Screepulous Observability — Data Extraction Reference

> **Purpose**: This document tells an external AI agent exactly where every piece of diagnostics, profiling, and tracking data lives so it can be scraped via the Screeps unofficial API.

---

## 1. Data Storage Overview

All data is stored in one of three places:

| Location | API Endpoint | Notes |
|---|---|---|
| **`Memory.stats`** | `GET /api/user/memory?path=stats` | Legacy stats mode (default). JSON under `Memory.stats`. Response is `gz:` + base64 gzip. |
| **RawMemory Segments** | `GET /api/user/memory-segment?segment=N` | Segments 0–99. Each up to 100KB of string data. |
| **Console output** | `POST /api/user/console` + WebSocket | Logger output, FlightRecorder dumps. Ephemeral. |

---

## 2. Segment Allocation Map

| Segment | Owner | Priority | Data |
|---|---|---|---|
| **0** | SegmentManager | CRITICAL | Master Index for virtual (split) segments |
| **1–9** | SegmentManager | Buffer range | General-purpose buffer |
| **90–96** | SegmentManager | Stats range | Reserved for stats/analytics |
| **97** | StatsExporter | LOW | Time-series metrics (Grafana/ScreepsPlus) |
| **98** | FlightRecorder | CRITICAL | State transitions (INFO/WARN events) |
| **99** | FlightRecorder | CRITICAL | Error/crash log (may be base-65536 packed) |

### Segment Access via API

```
GET https://screeps.com/api/user/memory-segment?segment=97
GET https://screeps.com/api/user/memory-segment?segment=98
GET https://screeps.com/api/user/memory-segment?segment=99
```

> [!IMPORTANT]
> Segments must be **activated** by the bot before they can be read. Segments 97–99 are activated persistently, so they should always be available.

---

## 3. StatsExporter — Segment 97 (or `Memory.stats`)

### Mode Detection

The bot can run in two modes. You should try **both** and see which one has data:

1. **Segment mode** → Read segment 97
2. **Legacy mode** → Read `Memory.stats` via `GET /api/user/memory?path=stats`

### Data Shape ([StatsSnapshot](file:///c:/code/screepulous/src/observability/StatsExporter.ts#47-67))

The segment contains a **JSON array** of up to 20 buffered tick snapshots (multi-tick buffer). Each element:

```jsonc
{
  // ── Core ──
  "tick": 14820000,
  "shard": "shard3",

  // ── CPU ──
  "cpu.used": 18.5,
  "cpu.limit": 20,
  "cpu.bucket": 9500,
  "cpu.tickLimit": 500,

  // ── GCL (Global Control Level) ──
  "gcl.level": 8,
  "gcl.progress": 1234567,
  "gcl.progressTotal": 5000000,

  // ── GPL (Global Power Level) ──
  "gpl.level": 2,
  "gpl.progress": 500,
  "gpl.progressTotal": 1000,

  // ── V8 Heap ──
  "heap.used": 45000000,
  "heap.limit": 67108864,
  "heap.ratio": 0.67,

  // ── Market ──
  "market.credits": 150000,
  "market.activeOrders": 5,

  // ── ErrorMapper Telemetry ──
  "errorMapper.totalErrors": 3,
  "errorMapper.mappedCount": 2,
  "errorMapper.rawCount": 1,
  "errorMapper.cpuUsed": 4.5,
  "errorMapper.uniqueFingerprints": 2,
  "errorMapper.deferredQueue": 0,
  "errorMapper.inResetLoop": 0,  // 1 = reset loop detected

  // ── GlobalCache Telemetry ──
  "cache.size": 45,
  "cache.dirtyCount": 3,
  "cache.pathCacheSize": 120,
  "cache.heapRatio": 0.67,
  "cache.evictedThisTick": 0,
  "cache.commitCPU": 0.8,
  "cache.schemaVersion": 1,
  "cache.bucketThrottled": 0,

  // ── Spawns ──
  "spawns.total": 3,
  "spawns.active": 1,
  "spawns.utilization": 0.33,
  "spawns.Spawn1.energy": 300,
  "spawns.Spawn1.spawning": 1,    // 1 = spawning, 0 = idle

  // ── Creeps ──
  "creeps.my": 28,
  "creeps.hostile": 0,
  "creeps.roles.harvester": 4,
  "creeps.roles.hauler": 8,
  // ... etc per role prefix

  // ── Per-Room Metrics ──
  "rooms.E1N8.energyAvailable": 1200,
  "rooms.E1N8.energyCapacity": 1800,
  "rooms.E1N8.controllerLevel": 6,
  "rooms.E1N8.controllerProgress": 500000,
  "rooms.E1N8.controllerProgressTotal": 1000000,
  "rooms.E1N8.storageEnergy": 45000,
  "rooms.E1N8.terminalEnergy": 5000,
  "rooms.E1N8.creepCount": 15,
  "rooms.E1N8.hostileCount": 0,

  // ── Defense ──
  "defense.towerCount": 2,
  "defense.towerEnergy": 1800,
  "defense.rampartCount": 40,
  "defense.rampartMinHits": 300000,

  // ── Process CPU Profile (Tier 1: macro, per OS process) ──
  "processes.Hatchery": 2.1,
  "processes.MiningSite": 1.5,
  // ... one key per active OS process

  // ── Function CPU Profile (Tier 2: micro, @Profile-decorated) ──
  "functions.GaleShapley.match.cpu": 1.2,
  "functions.GaleShapley.match.calls": 3,
  "functions.GaleShapley.match.max": 0.8
  // ... one group per profiled function
}
```

### Extraction Strategy

```
# Try segment mode first (preferred)
GET /api/user/memory-segment?segment=97

# If empty, fall back to legacy Memory path
GET /api/user/memory?path=stats
# Response: { ok, data: "gz:<base64-gzipped-json>" }
# Decode: base64 decode → gunzip → JSON.parse
```

---

## 4. FlightRecorder — Segments 98 & 99

The bot's "black box". Captures state transitions and errors in circular buffers.

### Segment 98: State Transitions (INFO/WARN)

Always plain JSON. Shape:

```jsonc
{
  "head": 42,           // Current write position in circular buffer
  "totalWrites": 157,   // Total entries ever written
  "entries": [           // Array of up to 50 entries (circular, may contain nulls)
    {
      "t": 14820000,    // Tick number
      "s": "I",         // Severity: "I"=info, "W"=warn, "E"=error
      "c": "Kernel",    // Context tag (max 30 chars)
      "m": "Process Hatchery started",  // Message (max 500 chars)
      "r": "E1N8",      // Room name (optional, for crash heatmap)
      "cid": "shard3-14820000-1"  // Correlation ID (optional, for distributed tracing)
    },
    null,  // Empty slot in circular buffer
    // ...
  ]
}
```

### Segment 99: Errors/Crashes

May be **base-65536 packed** (when packing is enabled on Shard 3/Season). Detection:

- If string starts with `P` → packed. Format: `P<byteLength>:<packedChars>`
- Otherwise → plain JSON, same shape as segment 98

Error entries also include:

```jsonc
{
  "t": 14820000,
  "s": "E",
  "c": "ErrorMapper",
  "m": "Cannot read property 'pos' of undefined",
  "st": "at MiningSite.run (src/sites/MiningSite.ts:45:12)...",  // Stack trace (max 1000 chars)
  "r": "E1N8",
  "cid": "shard3-14820000-1"
}
```

### Reading in Chronological Order

Entries are stored in a circular buffer. To read chronologically:

```python
# head points to the NEXT write position
# Read from head → end, then 0 → head-1 (skipping nulls)
entries_ordered = []
for i in range(len(entries)):
    idx = (head + i) % len(entries)
    if entries[idx] is not None:
        entries_ordered.append(entries[idx])
```

### Extraction

```
GET /api/user/memory-segment?segment=98   # Transitions
GET /api/user/memory-segment?segment=99   # Errors
```

---

## 5. Kernel CPU Profile (`Memory.kernel`)

The Kernel stores its state in `Memory.kernel` (via GlobalCache). The per-process CPU profile is generated per-tick and exported via StatsExporter (see `processes.*` keys above). It is **not** persisted separately — only available via the StatsExporter snapshot.

---

## 6. Additional API Endpoints for Full Diagnostics

Beyond the bot's own data, the Screeps API provides additional information:

### Room-Level Stats (Server-Side)
```
GET /api/game/room-overview?interval=8&room=E1N8
```
Returns server-side aggregated stats:
- `energyHarvested`, `energyConstruction`, `energyCreeps`, `energyControl`
- `creepsProduced`, `creepsLost`
- Available intervals: `8` (1h), `180` (24h), `1440` (7d)

### User Overview (All Rooms)
```
GET /api/user/overview?interval=1440&statName=energyHarvested
```
Valid `statName`: `creepsLost`, `creepsProduced`, `energyConstruction`, `energyControl`, `energyCreeps`, `energyHarvested`

### CPU/Account Info
```
GET /api/auth/me
```
Returns: `cpu` (allocation), `gcl`, `credits`, subscription time, etc.

### Market Data
```
GET /api/game/market/my-orders
GET /api/game/market/orders?resourceType=energy
GET /api/user/money-history
```

### Map Stats (Multi-Room)
```
POST /api/game/map-stats
Body: { rooms: ["E1N8", "E2N7"], statName: "owner0" }
```

### Console (Real-Time)
```
POST /api/user/console
Body: { expression: "FlightRecorder.dump()" }
```
> [!TIP]
> You can trigger a FlightRecorder dump from the console. The bot will read both segments and format them into the console output.

### Memory Paths
```
GET /api/user/memory?path=stats              # StatsExporter (legacy mode)
GET /api/user/memory?path=kernel             # Kernel state
GET /api/user/memory?path=heap               # GlobalCache serialized state
GET /api/user/memory                         # ALL memory (large, gzipped)
```

### Game Time
```
GET /api/game/time
```

### World Status
```
GET /api/user/world-status
```
Returns `"normal"`, `"lost"`, or `"empty"`.

---

## 7. Complete Extraction Checklist

| # | Data | Method | Rate Limit |
|---|---|---|---|
| 1 | **Stats snapshot** | `GET /memory-segment?segment=97` | 360/hour |
| 2 | **Flight transitions** | `GET /memory-segment?segment=98` | 360/hour |
| 3 | **Flight errors** | `GET /memory-segment?segment=99` | 360/hour |
| 4 | **Legacy stats** | `GET /memory?path=stats` | 1440/day |
| 5 | **Full memory** | `GET /memory` | 1440/day |
| 6 | **Room overview** (per room) | `GET /game/room-overview?interval=8&room=X` | 120/min (global) |
| 7 | **User overview** (aggregated) | `GET /user/overview?interval=1440&statName=X` | 120/min (global) |
| 8 | **Account info** | `GET /auth/me` | 120/min (global) |
| 9 | **Market orders** | `GET /game/market/my-orders` | 60/hour |
| 10 | **Money history** | `GET /user/money-history` | 60/hour |
| 11 | **Map stats** | `POST /game/map-stats` | 60/hour |
| 12 | **World status** | `GET /user/world-status` | 120/min (global) |
| 13 | **Game time** | `GET /game/time` | 120/min (global) |
| 14 | **Console command** | `POST /user/console` | 360/hour |
| 15 | **Room terrain** | `GET /game/room-terrain?room=X&encoded=1` | 360/hour |
| 16 | **Room history** | `GET /room-history/E1N8/<tick>.json` | No auth needed |
| 17 | **Leaderboard** | `GET /leaderboard/find?mode=world&username=X` | No auth needed |
| 18 | **PvP events** | `GET /experimental/pvp?interval=50` | 120/min (global) |

---

## 8. Authentication

Use an auth token (generated in account settings) with every request:

```
Header: X-Token: <your-token>
  — or —
Query:  ?_token=<your-token>
```

Global rate limit: **120 requests/minute** (with endpoint-specific limits as shown above).

---

## 9. Recommended Polling Strategy

| Interval | What to poll |
|---|---|
| **Every 15s** | Segment 97 (stats), game/time |
| **Every 60s** | Segments 98+99 (flight recorder), world-status |
| **Every 5min** | Room overviews (per room, interval=8), auth/me |
| **Every 30min** | User overview (all statNames), market orders, money-history |
| **On demand** | Console commands (`FlightRecorder.dump()`), full memory dump |
