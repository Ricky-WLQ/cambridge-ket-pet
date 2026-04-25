-- CreateEnum
CREATE TYPE "AudioStatus" AS ENUM ('GENERATING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "Test" ADD COLUMN     "audioErrorMessage" TEXT,
ADD COLUMN     "audioGenCompletedAt" TIMESTAMP(3),
ADD COLUMN     "audioGenStartedAt" TIMESTAMP(3),
ADD COLUMN     "audioR2Key" TEXT,
ADD COLUMN     "audioSegments" JSONB,
ADD COLUMN     "audioStatus" "AudioStatus";
