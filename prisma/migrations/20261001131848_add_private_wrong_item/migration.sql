-- CreateTable
CREATE TABLE "PrivateWrongItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "userAnswer" TEXT,
    "correctAnswer" TEXT NOT NULL,
    "wrongCount" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "firstSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PrivateWrongItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrivateWrongItem_userId_paperId_idx" ON "PrivateWrongItem"("userId", "paperId");

-- CreateIndex
CREATE INDEX "PrivateWrongItem_userId_status_idx" ON "PrivateWrongItem"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PrivateWrongItem_userId_paperId_questionId_key" ON "PrivateWrongItem"("userId", "paperId", "questionId");

-- AddForeignKey
ALTER TABLE "PrivateWrongItem" ADD CONSTRAINT "PrivateWrongItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
