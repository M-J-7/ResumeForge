-- CreateTable
CREATE TABLE "EventCount" (
    "name" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("name", "day")
);
