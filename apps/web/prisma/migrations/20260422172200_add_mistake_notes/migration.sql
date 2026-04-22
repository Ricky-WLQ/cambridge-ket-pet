-- CreateEnum
CREATE TYPE "NoteStatus" AS ENUM ('NEW', 'REVIEWED', 'MASTERED');

-- CreateTable
CREATE TABLE "MistakeNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "explanationZh" TEXT,
    "examPointId" TEXT,
    "difficultyPointId" TEXT,
    "status" "NoteStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MistakeNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MistakeNote_userId_status_idx" ON "MistakeNote"("userId", "status");

-- CreateIndex
CREATE INDEX "MistakeNote_attemptId_idx" ON "MistakeNote"("attemptId");

-- AddForeignKey
ALTER TABLE "MistakeNote" ADD CONSTRAINT "MistakeNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
