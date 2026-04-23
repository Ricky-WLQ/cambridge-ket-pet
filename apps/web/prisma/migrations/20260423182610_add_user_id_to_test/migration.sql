-- AlterTable
ALTER TABLE "Test" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "Test_userId_createdAt_idx" ON "Test"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
