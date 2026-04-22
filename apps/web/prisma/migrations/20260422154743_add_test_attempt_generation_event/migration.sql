-- CreateEnum
CREATE TYPE "TestKind" AS ENUM ('READING', 'WRITING', 'LISTENING', 'SPEAKING', 'MOCK_FULL', 'MOCK_SECTION');

-- CreateEnum
CREATE TYPE "TestMode" AS ENUM ('PRACTICE', 'MOCK');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'GRADED', 'ABANDONED');

-- CreateTable
CREATE TABLE "Test" (
    "id" TEXT NOT NULL,
    "examType" "ExamType" NOT NULL,
    "kind" "TestKind" NOT NULL,
    "part" INTEGER,
    "mode" "TestMode" NOT NULL,
    "difficulty" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "timeLimitSec" INTEGER,
    "generatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Test_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "mode" "TestMode" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "answers" JSONB,
    "rawScore" INTEGER,
    "totalPossible" INTEGER,
    "scaledScore" DOUBLE PRECISION,
    "weakPoints" JSONB,

    CONSTRAINT "TestAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Test_examType_kind_part_idx" ON "Test"("examType", "kind", "part");

-- CreateIndex
CREATE INDEX "Test_createdAt_idx" ON "Test"("createdAt");

-- CreateIndex
CREATE INDEX "TestAttempt_userId_startedAt_idx" ON "TestAttempt"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "TestAttempt_testId_idx" ON "TestAttempt"("testId");

-- CreateIndex
CREATE INDEX "GenerationEvent_userId_bucket_createdAt_idx" ON "GenerationEvent"("userId", "bucket", "createdAt");

-- AddForeignKey
ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationEvent" ADD CONSTRAINT "GenerationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
