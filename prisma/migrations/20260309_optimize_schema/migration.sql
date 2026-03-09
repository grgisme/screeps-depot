-- Migration: optimize_schema
-- Changes: UUID->int PKs, add dedupHash for dedup, add segment index

-- ─── Drop foreign keys first ────────────────────────────────────────────────
ALTER TABLE "TickStat" DROP CONSTRAINT IF EXISTS "TickStat_serverId_fkey";
ALTER TABLE "FlightRecorderEntry" DROP CONSTRAINT IF EXISTS "FlightRecorderEntry_serverId_fkey";
ALTER TABLE "Stat" DROP CONSTRAINT IF EXISTS "Stat_serverId_fkey";
ALTER TABLE "Log" DROP CONSTRAINT IF EXISTS "Log_serverId_fkey";

-- ─── Recreate TickStat ──────────────────────────────────────────────────────
DROP TABLE IF EXISTS "TickStat";
CREATE TABLE "TickStat" (
    "id" SERIAL NOT NULL,
    "tick" INTEGER NOT NULL,
    "shard" TEXT NOT NULL DEFAULT 'shard3',
    "data" JSONB NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverId" TEXT NOT NULL,

    CONSTRAINT "TickStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TickStat_serverId_tick_shard_key" ON "TickStat"("serverId", "tick", "shard");
CREATE INDEX "TickStat_serverId_recordedAt_idx" ON "TickStat"("serverId", "recordedAt");

ALTER TABLE "TickStat" ADD CONSTRAINT "TickStat_serverId_fkey"
    FOREIGN KEY ("serverId") REFERENCES "ScreepsServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Recreate FlightRecorderEntry ───────────────────────────────────────────
DROP TABLE IF EXISTS "FlightRecorderEntry";
CREATE TABLE "FlightRecorderEntry" (
    "id" SERIAL NOT NULL,
    "tick" INTEGER NOT NULL,
    "severity" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stackTrace" TEXT,
    "room" TEXT,
    "correlationId" TEXT,
    "segment" INTEGER NOT NULL,
    "dedupHash" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverId" TEXT NOT NULL,

    CONSTRAINT "FlightRecorderEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FlightRecorderEntry_dedupHash_key" ON "FlightRecorderEntry"("dedupHash");
CREATE INDEX "FlightRecorderEntry_serverId_recordedAt_idx" ON "FlightRecorderEntry"("serverId", "recordedAt");
CREATE INDEX "FlightRecorderEntry_severity_idx" ON "FlightRecorderEntry"("severity");
CREATE INDEX "FlightRecorderEntry_segment_idx" ON "FlightRecorderEntry"("segment");

ALTER TABLE "FlightRecorderEntry" ADD CONSTRAINT "FlightRecorderEntry_serverId_fkey"
    FOREIGN KEY ("serverId") REFERENCES "ScreepsServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Recreate Stat ──────────────────────────────────────────────────────────
DROP TABLE IF EXISTS "Stat";
CREATE TABLE "Stat" (
    "id" SERIAL NOT NULL,
    "data" JSONB NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverId" TEXT NOT NULL,

    CONSTRAINT "Stat_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Stat_serverId_idx" ON "Stat"("serverId");
CREATE INDEX "Stat_recordedAt_idx" ON "Stat"("recordedAt");

ALTER TABLE "Stat" ADD CONSTRAINT "Stat_serverId_fkey"
    FOREIGN KEY ("serverId") REFERENCES "ScreepsServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Recreate Log ───────────────────────────────────────────────────────────
DROP TABLE IF EXISTS "Log";
CREATE TABLE "Log" (
    "id" SERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'INFO',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverId" TEXT NOT NULL,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Log_serverId_idx" ON "Log"("serverId");
CREATE INDEX "Log_timestamp_idx" ON "Log"("timestamp");
CREATE INDEX "Log_severity_idx" ON "Log"("severity");

ALTER TABLE "Log" ADD CONSTRAINT "Log_serverId_fkey"
    FOREIGN KEY ("serverId") REFERENCES "ScreepsServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
