-- Absent days in attendance. Run once in the Neon SQL Editor.

-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "status" VARCHAR(10) NOT NULL DEFAULT 'PRESENT';
