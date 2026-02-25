-- AlterTable
ALTER TABLE "ScreepsServer" ADD COLUMN "apiBaseUrl" TEXT NOT NULL DEFAULT 'https://screeps.com',
ADD COLUMN "pollingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "pushToken" TEXT NOT NULL DEFAULT gen_random_uuid();

-- CreateIndex
CREATE UNIQUE INDEX "ScreepsServer_pushToken_key" ON "ScreepsServer"("pushToken");
