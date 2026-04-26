-- CreateTable
CREATE TABLE "GrammarTopic" (
    "id" TEXT NOT NULL,
    "examType" "ExamType" NOT NULL,
    "category" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "labelZh" TEXT NOT NULL,
    "spec" TEXT NOT NULL,
    "description" TEXT,
    "examples" TEXT[],
    "murphyUnits" INTEGER[],
    "source" TEXT NOT NULL,

    CONSTRAINT "GrammarTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrammarQuestion" (
    "id" TEXT NOT NULL,
    "examType" "ExamType" NOT NULL,
    "topicId" TEXT NOT NULL,
    "questionType" TEXT NOT NULL DEFAULT 'mcq',
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "correctIndex" INTEGER NOT NULL,
    "explanationEn" TEXT,
    "explanationZh" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 2,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrammarQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrammarProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "examType" "ExamType" NOT NULL,
    "topicId" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "userAnswer" INTEGER NOT NULL,
    "questionText" TEXT NOT NULL,
    "questionOptions" TEXT[],
    "correctIndex" INTEGER NOT NULL,
    "explanationZh" TEXT NOT NULL,
    "status" "NoteStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrammarProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GrammarTopic_examType_category_idx" ON "GrammarTopic"("examType", "category");

-- CreateIndex
CREATE UNIQUE INDEX "GrammarTopic_examType_topicId_key" ON "GrammarTopic"("examType", "topicId");

-- CreateIndex
CREATE INDEX "GrammarQuestion_examType_topicId_idx" ON "GrammarQuestion"("examType", "topicId");

-- CreateIndex
CREATE INDEX "GrammarProgress_userId_examType_topicId_idx" ON "GrammarProgress"("userId", "examType", "topicId");

-- CreateIndex
CREATE INDEX "GrammarProgress_userId_examType_status_idx" ON "GrammarProgress"("userId", "examType", "status");

-- CreateIndex
CREATE INDEX "GrammarProgress_userId_isCorrect_idx" ON "GrammarProgress"("userId", "isCorrect");

-- CreateIndex
CREATE UNIQUE INDEX "GrammarProgress_userId_questionId_key" ON "GrammarProgress"("userId", "questionId");

-- AddForeignKey
ALTER TABLE "GrammarQuestion" ADD CONSTRAINT "GrammarQuestion_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "GrammarTopic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrammarProgress" ADD CONSTRAINT "GrammarProgress_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "GrammarTopic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrammarProgress" ADD CONSTRAINT "GrammarProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
