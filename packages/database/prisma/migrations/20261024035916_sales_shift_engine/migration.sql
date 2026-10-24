-- AlterTable
ALTER TABLE "CashShift" ADD COLUMN     "salesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalCard" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalCash" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalDebt" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalOther" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalTransfer" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shiftId" TEXT;

-- CreateIndex
CREATE INDEX "CashShift_tenantId_userId_status_idx" ON "CashShift"("tenantId", "userId", "status");

-- CreateIndex
CREATE INDEX "Order_tenantId_shiftId_idx" ON "Order"("tenantId", "shiftId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "CashShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
