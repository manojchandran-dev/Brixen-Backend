-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata';

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "department_id" VARCHAR(16),
ADD COLUMN     "salary_period" VARCHAR(20),
ADD COLUMN     "salary_type" VARCHAR(20);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "employee_id" INTEGER,
ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "setup_email_error" TEXT,
ADD COLUMN     "setup_email_sent_at" TIMESTAMP(6);

-- CreateTable
CREATE TABLE "departments" (
    "id" VARCHAR(16) NOT NULL,
    "deleted_at" TIMESTAMP(6),
    "company_id" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_types" (
    "id" VARCHAR(16) NOT NULL,
    "deleted_at" TIMESTAMP(6),
    "company_id" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "rate" DECIMAL(12,2) NOT NULL,
    "status" VARCHAR(20) DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" VARCHAR(16) NOT NULL,
    "company_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "work_date" DATE NOT NULL,
    "recorded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timezone" VARCHAR(64) NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "notes" TEXT,
    "recorded_by" INTEGER,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_shifts" (
    "id" VARCHAR(16) NOT NULL,
    "attendance_id" VARCHAR(16) NOT NULL,
    "shift_no" INTEGER NOT NULL,
    "units" DECIMAL(4,2) NOT NULL,

    CONSTRAINT "attendance_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_pieces" (
    "id" VARCHAR(16) NOT NULL,
    "attendance_id" VARCHAR(16) NOT NULL,
    "work_type_id" VARCHAR(16) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "attendance_pieces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_permissions" (
    "id" VARCHAR(16) NOT NULL,
    "company_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "module_id" VARCHAR(16) NOT NULL,
    "view" BOOLEAN NOT NULL DEFAULT false,
    "create" BOOLEAN NOT NULL DEFAULT false,
    "edit" BOOLEAN NOT NULL DEFAULT false,
    "delete" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_company_id_work_date_idx" ON "attendance"("company_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_employee_id_work_date_key" ON "attendance"("employee_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_shifts_attendance_id_shift_no_key" ON "attendance_shifts"("attendance_id", "shift_no");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_pieces_attendance_id_work_type_id_key" ON "attendance_pieces"("attendance_id", "work_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_permissions_employee_id_module_id_key" ON "employee_permissions"("employee_id", "module_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "work_types" ADD CONSTRAINT "work_types_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "attendance_shifts" ADD CONSTRAINT "attendance_shifts_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "attendance"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "attendance_pieces" ADD CONSTRAINT "attendance_pieces_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "attendance"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "attendance_pieces" ADD CONSTRAINT "attendance_pieces_work_type_id_fkey" FOREIGN KEY ("work_type_id") REFERENCES "work_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employee_permissions" ADD CONSTRAINT "employee_permissions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employee_permissions" ADD CONSTRAINT "employee_permissions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employee_permissions" ADD CONSTRAINT "employee_permissions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

