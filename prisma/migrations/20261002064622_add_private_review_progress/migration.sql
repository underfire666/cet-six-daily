-- CreateTable
CREATE TABLE "PrivateReviewProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "reviewBatchId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "questionIds" JSONB NOT NULL,
    "answers" JSONB NOT NULL,
    "currentIndex" INTEGER NOT NULL DEFAULT 0,
    "submitted" BOOLEAN NOT NULL DEFAULT false,
    "result" JSONB,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PrivateReviewProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrivateReviewProgress_userId_idx" ON "PrivateReviewProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PrivateReviewProgress_userId_paperId_key" ON "PrivateReviewProgress"("userId", "paperId");

-- AddForeignKey
ALTER TABLE "PrivateReviewProgress" ADD CONSTRAINT "PrivateReviewProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
