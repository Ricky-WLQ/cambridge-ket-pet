-- CreateEnum
CREATE TYPE "SpeakingStatus" AS ENUM ('IDLE', 'IN_PROGRESS', 'SUBMITTED', 'SCORING', 'SCORED', 'FAILED');

-- AlterTable
ALTER TABLE "Test" ADD COLUMN     "speakingPersona" TEXT,
ADD COLUMN     "speakingPhotoKeys" TEXT[],
ADD COLUMN     "speakingPrompts" JSONB;

-- AlterTable
ALTER TABLE "TestAttempt" ADD COLUMN     "akoolSessionId" TEXT,
ADD COLUMN     "rubricScores" JSONB,
ADD COLUMN     "speakingError" TEXT,
ADD COLUMN     "speakingStatus" "SpeakingStatus",
ADD COLUMN     "transcript" JSONB;
