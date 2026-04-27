-- CreateEnum
CREATE TYPE "DiagnoseStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETE', 'REPORT_READY', 'REPORT_FAILED');

-- CreateEnum
CREATE TYPE "DiagnoseSectionStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'GRADED');

-- AlterEnum
ALTER TYPE "TestKind" ADD VALUE 'DIAGNOSE';

-- CreateTable
CREATE TABLE "WeeklyDiagnose" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "testId" TEXT NOT NULL,
    "examType" "ExamType" NOT NULL,
    "status" "DiagnoseStatus" NOT NULL DEFAULT 'PENDING',
    "readingAttemptId" TEXT,
    "listeningAttemptId" TEXT,
    "writingAttemptId" TEXT,
    "speakingAttemptId" TEXT,
    "vocabAttemptId" TEXT,
    "grammarAttemptId" TEXT,
    "readingStatus" "DiagnoseSectionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "listeningStatus" "DiagnoseSectionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "writingStatus" "DiagnoseSectionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "speakingStatus" "DiagnoseSectionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "vocabStatus" "DiagnoseSectionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "grammarStatus" "DiagnoseSectionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "completedAt" TIMESTAMP(3),
    "reportAt" TIMESTAMP(3),
    "knowledgePoints" JSONB,
    "summary" JSONB,
    "perSectionScores" JSONB,
    "overallScore" DOUBLE PRECISION,
    "reportError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyDiagnose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyDiagnose_testId_key" ON "WeeklyDiagnose"("testId");

-- CreateIndex
CREATE INDEX "WeeklyDiagnose_userId_status_idx" ON "WeeklyDiagnose"("userId", "status");

-- CreateIndex
CREATE INDEX "WeeklyDiagnose_weekStart_idx" ON "WeeklyDiagnose"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyDiagnose_userId_weekStart_key" ON "WeeklyDiagnose"("userId", "weekStart");

-- AddForeignKey
ALTER TABLE "WeeklyDiagnose" ADD CONSTRAINT "WeeklyDiagnose_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyDiagnose" ADD CONSTRAINT "WeeklyDiagnose_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;
