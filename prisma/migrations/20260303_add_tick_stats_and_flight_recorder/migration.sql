-- AlterTable: Add shard field to ScreepsServer
ALTER TABLE "ScreepsServer" ADD COLUMN "shard" TEXT NOT NULL DEFAULT 'shard3';

-- CreateTable: TickStat
CREATE TABLE "TickStat" (
    "id" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "shard" TEXT NOT NULL DEFAULT 'shard3',
    "data" JSONB NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverId" TEXT NOT NULL,

    CONSTRAINT "TickStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FlightRecorderEntry
CREATE TABLE "FlightRecorderEntry" (
    "id" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "severity" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stackTrace" TEXT,
    "room" TEXT,
    "correlationId" TEXT,
    "segment" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverId" TEXT NOT NULL,

    CONSTRAINT "FlightRecorderEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: TickStat
CREATE UNIQUE INDEX "TickStat_serverId_tick_shard_key" ON "TickStat"("serverId", "tick", "shard");
CREATE INDEX "TickStat_serverId_recordedAt_idx" ON "TickStat"("serverId", "recordedAt");

-- CreateIndex: FlightRecorderEntry
CREATE UNIQUE INDEX "FlightRecorderEntry_serverId_tick_segment_context_message_key" ON "FlightRecorderEntry"("serverId", "tick", "segment", "context", "message");
CREATE INDEX "FlightRecorderEntry_serverId_recordedAt_idx" ON "FlightRecorderEntry"("serverId", "recordedAt");
CREATE INDEX "FlightRecorderEntry_severity_idx" ON "FlightRecorderEntry"("severity");

-- AddForeignKey: TickStat -> ScreepsServer
ALTER TABLE "TickStat" ADD CONSTRAINT "TickStat_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ScreepsServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: FlightRecorderEntry -> ScreepsServer
ALTER TABLE "FlightRecorderEntry" ADD CONSTRAINT "FlightRecorderEntry_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ScreepsServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
