-- AlterTable
ALTER TABLE "PrivateWrongItem" ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "PrivateWrongItem_userId_paperId_removedAt_idx" ON "PrivateWrongItem"("userId", "paperId", "removedAt");
