-- CreateTable
CREATE TABLE "FarmMap" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 7,
    "height" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmTile" (
    "id" SERIAL NOT NULL,
    "farmId" INTEGER NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "terrain" TEXT NOT NULL DEFAULT 'GRASS',
    "unlocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FarmTile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmObject" (
    "id" SERIAL NOT NULL,
    "farmId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmObject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FarmMap_userId_key" ON "FarmMap"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FarmTile_farmId_x_y_key" ON "FarmTile"("farmId", "x", "y");

-- CreateIndex
CREATE INDEX "FarmObject_farmId_x_y_idx" ON "FarmObject"("farmId", "x", "y");

-- AddForeignKey
ALTER TABLE "FarmMap" ADD CONSTRAINT "FarmMap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmTile" ADD CONSTRAINT "FarmTile_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "FarmMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmObject" ADD CONSTRAINT "FarmObject_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "FarmMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
