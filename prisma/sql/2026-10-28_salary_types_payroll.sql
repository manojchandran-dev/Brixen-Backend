-- Salary types (Shift, Piece Rate, Hourly, Weekly, Monthly), hours / day
-- attendance, and salary generation (payroll runs + payslips).
-- Run once in the Neon SQL Editor, top to bottom.

-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "day_units" DECIMAL(3,2),
ADD COLUMN     "hours" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" VARCHAR(16) NOT NULL,
    "company_id" INTEGER NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "period_from" DATE NOT NULL,
    "period_to" DATE NOT NULL,
    "working_days" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "total_gross" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_net" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_by" INTEGER,
    "finalized_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" VARCHAR(16) NOT NULL,
    "run_id" VARCHAR(16) NOT NULL,
    "company_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "salary_type" VARCHAR(20) NOT NULL,
    "rate" DECIMAL(12,2),
    "units" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "days_present" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "gross" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "additions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "breakdown" JSONB,
    "notes" TEXT,
    "emailed_at" TIMESTAMP(6),
    "email_error" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_company_id_month_key" ON "payroll_runs"("company_id", "month");

-- CreateIndex
CREATE INDEX "payslips_employee_id_idx" ON "payslips"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_run_id_employee_id_key" ON "payslips"("run_id", "employee_id");

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;


-- Data: a Shift Rate employee paid hourly / weekly / monthly becomes that
-- salary type; the rest of Shift Rate is paid per shift.
UPDATE "employees" SET "salary_type" = "salary_period"
WHERE "salary_type" = 'SHIFT_RATE' AND "salary_period" IN ('HOURLY', 'WEEKLY', 'MONTHLY');
UPDATE "employees" SET "salary_period" = 'PER_SHIFT' WHERE "salary_type" = 'SHIFT_RATE';
