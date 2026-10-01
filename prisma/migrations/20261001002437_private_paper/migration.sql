-- CreateTable
CREATE TABLE "PrivatePaper" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PrivatePaper_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrivatePaper_userId_idx" ON "PrivatePaper"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PrivatePaper_userId_paperId_key" ON "PrivatePaper"("userId", "paperId");

-- AddForeignKey
ALTER TABLE "PrivatePaper" ADD CONSTRAINT "PrivatePaper_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
