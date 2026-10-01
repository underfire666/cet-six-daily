-- CreateTable
CREATE TABLE "PrivatePaperProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "progressVersion" INTEGER NOT NULL DEFAULT 1,
    "contentHash" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "currentIndex" INTEGER NOT NULL DEFAULT 0,
    "submitted" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PrivatePaperProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrivatePaperProgress_userId_idx" ON "PrivatePaperProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PrivatePaperProgress_userId_paperId_key" ON "PrivatePaperProgress"("userId", "paperId");

-- AddForeignKey
ALTER TABLE "PrivatePaperProgress" ADD CONSTRAINT "PrivatePaperProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
