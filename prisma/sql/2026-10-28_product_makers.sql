-- Piece-rate pay from sales: the employees who make each product, and the
-- payslip rate's unit. Run once in
-- the Neon SQL Editor. (Replaces the lots table, if it was ever created.)

DROP TABLE IF EXISTS "piece_lots";

-- A payslip keeps what its rate was per (per piece / per dozen).
ALTER TABLE "payslips" ADD COLUMN "salary_period" VARCHAR(20);

-- CreateTable
CREATE TABLE "product_makers" (
    "product_id" VARCHAR(16) NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_makers_pkey" PRIMARY KEY ("product_id","employee_id")
);

-- CreateIndex
CREATE INDEX "product_makers_employee_id_idx" ON "product_makers"("employee_id");

-- AddForeignKey
ALTER TABLE "product_makers" ADD CONSTRAINT "product_makers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_makers" ADD CONSTRAINT "product_makers_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
