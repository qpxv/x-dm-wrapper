-- AlterTable
ALTER TABLE "PushSubscription" ADD COLUMN "deviceId" TEXT NOT NULL;

-- DropColumn
ALTER TABLE "PushSubscription" DROP COLUMN "deviceLabel";

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_deviceId_key" ON "PushSubscription"("deviceId");
