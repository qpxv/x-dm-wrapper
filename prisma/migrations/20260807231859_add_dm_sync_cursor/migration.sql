-- CreateTable
CREATE TABLE "DmSyncCursor" (
    "id" TEXT NOT NULL,
    "lastEventId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DmSyncCursor_pkey" PRIMARY KEY ("id")
);

