-- ═══════════════════════════════════════════════════════════════════════════
--  Tenant Row-Level Security (RLS)
--
--  Har bir tenant jadvali faqat `app.tenant_id` session o'zgaruvchisiga mos
--  qatorlarni ko'rsatadi. Bu ilova kodidagi tenantId filtrlaridan mustaqil
--  ikkinchi himoya qatlami.
--
--  MUHIM (production):
--   1. Ilova PostgreSQLga TABLE OWNER bo'lmagan rol bilan ulanishi kerak
--      (owner RLSni chetlab o'tadi). Masalan: `savdo_app`.
--   2. Har bir so'rov oldidan tenant kontekstini o'rnating:
--        SELECT set_config('app.tenant_id', $1, true);   -- tranzaksiya ichida
--      Buni `withTenantContext()` (packages/database/src/tenant.ts) bajaradi.
--   3. Migratsiyalar/seed owner roli bilan ishlaydi (RLS bypass).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "User"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Role"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "RolePermission" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "RolePermission"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Session"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Store" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Store"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Warehouse" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Warehouse"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Category"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Unit" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Unit"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Product"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "ProductVariant" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ProductVariant"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Barcode" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Barcode"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Inventory" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Inventory"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "StockMovementLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "StockMovementLog"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "StockTransfer" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "StockTransfer"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "StockTransferItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "StockTransferItem"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Customer"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Supplier" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Supplier"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "DebtRecord" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "DebtRecord"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "DebtPayment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "DebtPayment"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Order"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "OrderItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "OrderItem"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "PaymentTransaction" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PaymentTransaction"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "CashShift" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "CashShift"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "ExpenseCategory" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ExpenseCategory"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Expense"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AuditLog"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Eslatma: "Tenant" jadvali ataylab RLSdan tashqarida — login paytida tenant
-- slug bo'yicha topiladi va undan keyingi barcha so'rovlar RLS bilan himoyalanadi.
