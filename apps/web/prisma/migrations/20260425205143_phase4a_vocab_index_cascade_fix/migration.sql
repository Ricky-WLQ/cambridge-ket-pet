-- DropForeignKey
ALTER TABLE "VocabProgress" DROP CONSTRAINT "VocabProgress_wordId_fkey";

-- DropIndex
DROP INDEX "Word_examType_topics_idx";

-- CreateIndex
CREATE INDEX "Word_topics_idx" ON "Word" USING GIN ("topics");

-- AddForeignKey
ALTER TABLE "VocabProgress" ADD CONSTRAINT "VocabProgress_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
