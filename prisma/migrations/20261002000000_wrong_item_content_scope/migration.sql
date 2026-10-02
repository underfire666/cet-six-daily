-- Preserve existing records; each content version has its own wrong-question identity.
DROP INDEX "PrivateWrongItem_userId_paperId_questionId_key";
CREATE UNIQUE INDEX "PrivateWrongItem_userId_paperId_contentHash_questionId_key"
ON "PrivateWrongItem"("userId", "paperId", "contentHash", "questionId");
