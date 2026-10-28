-- Piece lots: piece work counted at delivery (e.g. 800 dozen x 12 x rate),
-- paid by salary generation. Run once in the Neon SQL Editor.

-- CreateTable
CREATE TABLE "piece_lots" (
    "id" VARCHAR(16) NOT NULL,
    "company_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "work_type_id" VARCHAR(16) NOT NULL,
    "lot_date" DATE NOT NULL,
    "unit" VARCHAR(10) NOT NULL DEFAULT 'PIECE',
    "quantity" INTEGER NOT NULL,
    "pieces" INTEGER NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "recorded_by" INTEGER,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "piece_lots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "piece_lots_company_id_lot_date_idx" ON "piece_lots"("company_id", "lot_date");

-- CreateIndex
CREATE INDEX "piece_lots_employee_id_idx" ON "piece_lots"("employee_id");

-- AddForeignKey
ALTER TABLE "piece_lots" ADD CONSTRAINT "piece_lots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "piece_lots" ADD CONSTRAINT "piece_lots_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "piece_lots" ADD CONSTRAINT "piece_lots_work_type_id_fkey" FOREIGN KEY ("work_type_id") REFERENCES "work_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

