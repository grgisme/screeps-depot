-- Migration: auto_tuning_retention
-- Add SystemDiagnostic and SystemSetting tables

-- ─── SystemDiagnostic ────────────────────────────────────────────────────────
CREATE TABLE "SystemDiagnostic" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemDiagnostic_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SystemDiagnostic_type_recordedAt_idx" ON "SystemDiagnostic"("type", "recordedAt");

-- ─── SystemSetting ───────────────────────────────────────────────────────────
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);
