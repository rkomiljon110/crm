import type { Prisma } from "@prisma/client";
import { prisma } from "./client";

export type TenantTx = Prisma.TransactionClient;

/**
 * Tenant kontekstida tranzaksiya bajaradi.
 *
 * `set_config('app.tenant_id', ..., true)` faqat shu tranzaksiya uchun amal
 * qiladi va PostgreSQL RLS siyosatlari qaysi qatorlar ko'rinishini belgilaydi.
 *
 * Productionda DATABASE_URL `savdo_app` kabi table-owner bo'lmagan rolga
 * ishora qilishi kerak; aks holda RLS chetlab o'tiladi.
 */
export async function withTenantContext<T>(
  tenantId: string,
  fn: (tx: TenantTx) => Promise<T>,
  options?: { timeout?: number; maxWait?: number },
): Promise<T> {
  if (!tenantId) {
    throw new Error("withTenantContext: tenantId majburiy");
  }

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return fn(tx);
    },
    {
      timeout: options?.timeout ?? 15_000,
      maxWait: options?.maxWait ?? 5_000,
    },
  );
}

/** Tenant kontekstini o'rnatmasdan turib tenantId bo'yicha filtr (owner rollari uchun) */
export function tenantWhere(tenantId: string) {
  return { tenantId };
}
