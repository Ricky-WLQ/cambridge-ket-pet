-- CreateEnum
CREATE TYPE "WordTier" AS ENUM ('CORE', 'RECOMMENDED', 'EXTRA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TestKind" ADD VALUE 'VOCAB';
ALTER TYPE "TestKind" ADD VALUE 'GRAMMAR';

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "targetTier" "WordTier",
ADD COLUMN     "targetTopicId" TEXT,
ADD COLUMN     "targetWordCount" INTEGER;

-- CreateTable
CREATE TABLE "Word" (
    "id" TEXT NOT NULL,
    "examType" "ExamType" NOT NULL,
    "cambridgeId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "pos" TEXT NOT NULL,
    "phonetic" TEXT,
    "glossEn" TEXT,
    "glossZh" TEXT NOT NULL,
    "example" TEXT,
    "topics" TEXT[],
    "tier" "WordTier" NOT NULL DEFAULT 'RECOMMENDED',
    "audioKey" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Word_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examType" "ExamType" NOT NULL,
    "wordId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "mastery" INTEGER NOT NULL DEFAULT 0,
    "lastReviewed" TIMESTAMP(3),
    "nextReview" TIMESTAMP(3),
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VocabProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Word_examType_tier_idx" ON "Word"("examType", "tier");

-- CreateIndex
CREATE INDEX "Word_examType_topics_idx" ON "Word"("examType", "topics");

-- CreateIndex
CREATE UNIQUE INDEX "Word_examType_cambridgeId_key" ON "Word"("examType", "cambridgeId");

-- CreateIndex
CREATE INDEX "VocabProgress_userId_examType_mastery_idx" ON "VocabProgress"("userId", "examType", "mastery");

-- CreateIndex
CREATE INDEX "VocabProgress_userId_examType_nextReview_idx" ON "VocabProgress"("userId", "examType", "nextReview");

-- CreateIndex
CREATE UNIQUE INDEX "VocabProgress_userId_wordId_key" ON "VocabProgress"("userId", "wordId");

-- AddForeignKey
ALTER TABLE "VocabProgress" ADD CONSTRAINT "VocabProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabProgress" ADD CONSTRAINT "VocabProgress_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;
