-- Piece pay entered after sales (employee + work type + quantity, in pieces
-- or combos of a product), product combo sizes, and the old lots table
-- removed. Run once in the Neon SQL Editor.

-- DropForeignKey
ALTER TABLE "piece_lots" DROP CONSTRAINT "piece_lots_company_id_fkey";

-- DropForeignKey
ALTER TABLE "piece_lots" DROP CONSTRAINT "piece_lots_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "piece_lots" DROP CONSTRAINT "piece_lots_work_type_id_fkey";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "combo_size" INTEGER;

-- DropTable
DROP TABLE "piece_lots";

-- CreateTable
CREATE TABLE "piece_pays" (
    "id" VARCHAR(16) NOT NULL,
    "company_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "work_type_id" VARCHAR(16) NOT NULL,
    "product_id" VARCHAR(16),
    "pay_date" DATE NOT NULL,
    "unit" VARCHAR(10) NOT NULL DEFAULT 'PIECE',
    "quantity" INTEGER NOT NULL,
    "combo_size" INTEGER,
    "pieces" INTEGER NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "confirmed_at" TIMESTAMP(6),
    "emailed_at" TIMESTAMP(6),
    "email_error" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "piece_pays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "piece_pays_company_id_pay_date_idx" ON "piece_pays"("company_id", "pay_date");

-- CreateIndex
CREATE INDEX "piece_pays_employee_id_idx" ON "piece_pays"("employee_id");

-- AddForeignKey
ALTER TABLE "piece_pays" ADD CONSTRAINT "piece_pays_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "piece_pays" ADD CONSTRAINT "piece_pays_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "piece_pays" ADD CONSTRAINT "piece_pays_work_type_id_fkey" FOREIGN KEY ("work_type_id") REFERENCES "work_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "piece_pays" ADD CONSTRAINT "piece_pays_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

