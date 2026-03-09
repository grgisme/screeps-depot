-- Migration: normalize_schema
-- Drop JSON blob tables (Stat, TickStat) and replace with typed TickSnapshot + child tables

-- ─── Drop old tables ────────────────────────────────────────────────────────
DROP TABLE IF EXISTS "Stat";
DROP TABLE IF EXISTS "TickStat";

-- ─── TickSnapshot ───────────────────────────────────────────────────────────
CREATE TABLE "TickSnapshot" (
    "id" SERIAL NOT NULL,
    "tick" INTEGER NOT NULL,
    "shard" TEXT NOT NULL DEFAULT 'shard3',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverId" TEXT NOT NULL,

    -- CPU
    "cpuUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpuLimit" INTEGER NOT NULL DEFAULT 0,
    "cpuBucket" INTEGER NOT NULL DEFAULT 0,
    "cpuTickLimit" INTEGER NOT NULL DEFAULT 0,

    -- GCL / GPL
    "gclLevel" INTEGER NOT NULL DEFAULT 0,
    "gclProgress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gclProgressTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gplLevel" INTEGER NOT NULL DEFAULT 0,
    "gplProgress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gplProgressTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,

    -- Heap
    "heapUsed" BIGINT NOT NULL DEFAULT 0,
    "heapLimit" BIGINT NOT NULL DEFAULT 0,
    "heapRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,

    -- Market
    "marketCredits" INTEGER NOT NULL DEFAULT 0,
    "marketActiveOrders" INTEGER NOT NULL DEFAULT 0,

    -- Creeps
    "creepsMy" INTEGER NOT NULL DEFAULT 0,
    "creepsHostile" INTEGER NOT NULL DEFAULT 0,

    -- Spawns
    "spawnsTotal" INTEGER NOT NULL DEFAULT 0,
    "spawnsActive" INTEGER NOT NULL DEFAULT 0,
    "spawnsUtilization" DOUBLE PRECISION NOT NULL DEFAULT 0,

    -- Defense
    "defenseTowerCount" INTEGER NOT NULL DEFAULT 0,
    "defenseTowerEnergy" INTEGER NOT NULL DEFAULT 0,
    "defenseRampartCount" INTEGER NOT NULL DEFAULT 0,
    "defenseRampartMinHits" BIGINT NOT NULL DEFAULT 0,

    -- ErrorMapper
    "errorMapperTotalErrors" INTEGER NOT NULL DEFAULT 0,
    "errorMapperMappedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMapperRawCount" INTEGER NOT NULL DEFAULT 0,
    "errorMapperCpuUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "errorMapperUniqueFingerprints" INTEGER NOT NULL DEFAULT 0,
    "errorMapperDeferredQueue" INTEGER NOT NULL DEFAULT 0,
    "errorMapperInResetLoop" INTEGER NOT NULL DEFAULT 0,

    -- Cache
    "cacheSize" INTEGER NOT NULL DEFAULT 0,
    "cacheDirtyCount" INTEGER NOT NULL DEFAULT 0,
    "cachePathCacheSize" INTEGER NOT NULL DEFAULT 0,
    "cacheHeapRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cacheEvictedThisTick" INTEGER NOT NULL DEFAULT 0,
    "cacheCommitCPU" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cacheSchemaVersion" INTEGER NOT NULL DEFAULT 0,
    "cacheBucketThrottled" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TickSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TickSnapshot_serverId_tick_shard_key" ON "TickSnapshot"("serverId", "tick", "shard");
CREATE INDEX "TickSnapshot_serverId_recordedAt_idx" ON "TickSnapshot"("serverId", "recordedAt");

ALTER TABLE "TickSnapshot" ADD CONSTRAINT "TickSnapshot_serverId_fkey"
    FOREIGN KEY ("serverId") REFERENCES "ScreepsServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── RoomSnapshot ───────────────────────────────────────────────────────────
CREATE TABLE "RoomSnapshot" (
    "id" SERIAL NOT NULL,
    "tickSnapshotId" INTEGER NOT NULL,
    "roomName" TEXT NOT NULL,
    "energyAvailable" INTEGER NOT NULL DEFAULT 0,
    "energyCapacity" INTEGER NOT NULL DEFAULT 0,
    "controllerLevel" INTEGER NOT NULL DEFAULT 0,
    "controllerProgress" BIGINT NOT NULL DEFAULT 0,
    "controllerProgressTotal" BIGINT NOT NULL DEFAULT 0,
    "storageEnergy" INTEGER NOT NULL DEFAULT 0,
    "terminalEnergy" INTEGER NOT NULL DEFAULT 0,
    "creepCount" INTEGER NOT NULL DEFAULT 0,
    "hostileCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RoomSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoomSnapshot_tickSnapshotId_idx" ON "RoomSnapshot"("tickSnapshotId");

ALTER TABLE "RoomSnapshot" ADD CONSTRAINT "RoomSnapshot_tickSnapshotId_fkey"
    FOREIGN KEY ("tickSnapshotId") REFERENCES "TickSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── ProcessSnapshot ────────────────────────────────────────────────────────
CREATE TABLE "ProcessSnapshot" (
    "id" SERIAL NOT NULL,
    "tickSnapshotId" INTEGER NOT NULL,
    "processName" TEXT NOT NULL,
    "cpuUsed" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ProcessSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProcessSnapshot_tickSnapshotId_idx" ON "ProcessSnapshot"("tickSnapshotId");

ALTER TABLE "ProcessSnapshot" ADD CONSTRAINT "ProcessSnapshot_tickSnapshotId_fkey"
    FOREIGN KEY ("tickSnapshotId") REFERENCES "TickSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── CreepRoleSnapshot ──────────────────────────────────────────────────────
CREATE TABLE "CreepRoleSnapshot" (
    "id" SERIAL NOT NULL,
    "tickSnapshotId" INTEGER NOT NULL,
    "roleName" TEXT NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "CreepRoleSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CreepRoleSnapshot_tickSnapshotId_idx" ON "CreepRoleSnapshot"("tickSnapshotId");

ALTER TABLE "CreepRoleSnapshot" ADD CONSTRAINT "CreepRoleSnapshot_tickSnapshotId_fkey"
    FOREIGN KEY ("tickSnapshotId") REFERENCES "TickSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
