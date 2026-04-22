-- CreateTable
CREATE TABLE "ExamPoint" (
    "id" TEXT NOT NULL,
    "examType" "ExamType" NOT NULL,
    "paperCode" TEXT NOT NULL,
    "part" INTEGER,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "descriptionZh" TEXT NOT NULL,
    "skillTags" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DifficultyPoint" (
    "id" TEXT NOT NULL,
    "examType" "ExamType",
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "descriptionZh" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DifficultyPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamPoint_examType_idx" ON "ExamPoint"("examType");

-- CreateIndex
CREATE UNIQUE INDEX "ExamPoint_examType_paperCode_part_key" ON "ExamPoint"("examType", "paperCode", "part");

-- CreateIndex
CREATE INDEX "DifficultyPoint_examType_idx" ON "DifficultyPoint"("examType");

-- CreateIndex
CREATE INDEX "DifficultyPoint_category_idx" ON "DifficultyPoint"("category");
