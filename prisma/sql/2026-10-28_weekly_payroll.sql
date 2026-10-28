-- Weekly salary runs beside monthly ones. Run once in the Neon SQL Editor.

-- AlterTable
ALTER TABLE "payroll_runs" ADD COLUMN     "period_type" VARCHAR(10) NOT NULL DEFAULT 'MONTH',
ALTER COLUMN "month" SET DATA TYPE VARCHAR(10);
