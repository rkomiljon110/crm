import { Prisma, withTenantContext } from "@repo/database";
import { PAYMENT_METHOD_VALUES } from "@repo/shared";
import type { SessionUser } from "@/lib/types";
import { getCurrentShift } from "@/lib/sales/shifts";
import { SalesError } from "@/lib/sales/errors";

export interface PosBootstrapParams {
  warehouseId?: string;
  q?: string;
}

/**
 * POS/desktop/mobil klient uchun boshlang'ich kontekst:
 * joriy smena, filiallar, omborlar, shtrix-kod/nom bo'yicha katalog va
 * nasiya uchun mijozlar. Tannarx ataylab qaytarilmaydi.
 *
 * Bu endpoint `pos.use` ruxsatini talab qiladi; boshqa filial omborlari
 * faqat `settings.manage` egasiga ko'rinadi.
 */
export async function getPosBootstrap(user: SessionUser, params: PosBootstrapParams = {}) {
  const shift = await getCurrentShift({ tenantId: user.tenantId, userId: user.id });

  return withTenantContext(user.tenantId, async (tx) => {
    const canAnyStore = user.permissions.includes("settings.manage");
    const storeScope: Prisma.StoreWhereInput = canAnyStore
      ? {}
      : { id: user.storeId ?? "__no_store__" };
    const warehouseScope: Prisma.WarehouseWhereInput = canAnyStore
      ? {}
      : { OR: [{ storeId: user.storeId }, { storeId: null }] };

    const [stores, warehouses, tenant] = await Promise.all([
      tx.store.findMany({
        where: { tenantId: user.tenantId, isActive: true, ...storeScope },
        select: { id: true, code: true, name: true },
        orderBy: { code: "asc" },
      }),
      tx.warehouse.findMany({
        where: { tenantId: user.tenantId, isActive: true, ...warehouseScope },
        select: { id: true, code: true, name: true, storeId: true, type: true },
        orderBy: [{ type: "asc" }, { code: "asc" }],
      }),
      tx.tenant.findUnique({
        where: { id: user.tenantId },
        select: { currency: true, usdRate: true, timezone: true },
      }),
    ]);

    if (warehouses.length === 0) {
      throw new SalesError(404, "WAREHOUSE_NOT_FOUND", "Faol ombor topilmadi.");
    }

    let selectedWarehouse = params.warehouseId
      ? warehouses.find((warehouse) => warehouse.id === params.warehouseId)
      : undefined;
    if (params.warehouseId && !selectedWarehouse) {
      throw new SalesError(404, "WAREHOUSE_NOT_FOUND", "Ombor topilmadi yoki bu filialga tegishli emas.");
    }

    if (!selectedWarehouse) {
      const shiftStoreId = shift?.storeId ?? user.storeId ?? null;
      selectedWarehouse =
        warehouses.find((warehouse) => warehouse.storeId === shiftStoreId) ??
        warehouses.find((warehouse) => warehouse.storeId !== null) ??
        warehouses[0];
    }

    const q = params.q?.trim() || null;
    const searchFilter: Prisma.ProductVariantWhereInput | null = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
            { barcodes: { some: { code: { contains: q } } } },
            { product: { name: { contains: q, mode: "insensitive" } } },
            { product: { sku: { contains: q, mode: "insensitive" } } },
          ],
        }
      : null;

    const [variants, customers] = await Promise.all([
      tx.productVariant.findMany({
        where: {
          tenantId: user.tenantId,
          isActive: true,
          product: { isActive: true },
          ...(searchFilter ? { AND: [searchFilter] } : {}),
        },
        select: {
          id: true,
          name: true,
          sku: true,
          attributes: true,
          sellingPrice: true,
          wholesalePrice: true,
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              hasVariants: true,
              category: { select: { name: true } },
              unit: { select: { shortName: true, allowDecimal: true } },
            },
          },
          barcodes: {
            select: { code: true, isPrimary: true },
            orderBy: { isPrimary: "desc" },
          },
          inventories: {
            where: { warehouseId: selectedWarehouse.id },
            select: { quantity: true },
          },
        },
        orderBy: [{ product: { name: "asc" } }, { name: "asc" }],
        take: 50,
      }),
      tx.customer.findMany({
        where: { tenantId: user.tenantId },
        select: {
          id: true,
          name: true,
          phone: true,
          debtBalance: true,
          maxDebtLimit: true,
          isBlocked: true,
        },
        orderBy: [{ debtBalance: "desc" }, { name: "asc" }],
        take: 30,
      }),
    ]);

    return {
      serverTime: new Date().toISOString(),
      user: {
        id: user.id,
        name: user.name,
        roleCode: user.roleCode,
        roleName: user.roleName,
        storeId: user.storeId,
        storeName: user.storeName,
        permissions: user.permissions,
      },
      tenant: {
        currency: tenant?.currency ?? "UZS",
        usdRate: Number(tenant?.usdRate ?? 0),
        timezone: tenant?.timezone ?? "Asia/Tashkent",
      },
      shift,
      stores,
      warehouses,
      selectedWarehouseId: selectedWarehouse.id,
      products: variants.map((variant) => ({
        variantId: variant.id,
        productId: variant.product.id,
        name: variant.product.name,
        variantName: variant.name,
        sku: variant.sku ?? variant.product.sku,
        barcodes: variant.barcodes.map((barcode) => barcode.code),
        barcode: variant.barcodes[0]?.code ?? null,
        price: Number(variant.sellingPrice),
        wholesalePrice: variant.wholesalePrice === null ? null : Number(variant.wholesalePrice),
        stock: Number(variant.inventories[0]?.quantity ?? 0),
        unit: variant.product.unit.shortName,
        allowDecimal: variant.product.unit.allowDecimal,
        category: variant.product.category.name,
        hasVariants: variant.product.hasVariants,
        attributes: variant.attributes,
      })),
      customers: customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        debtBalance: Number(customer.debtBalance),
        maxDebtLimit: Number(customer.maxDebtLimit),
        isBlocked: customer.isBlocked,
      })),
      paymentMethods: [...PAYMENT_METHOD_VALUES, "DEBT"] as const,
    };
  });
}
