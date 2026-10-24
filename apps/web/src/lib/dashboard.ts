import { withTenantContext } from "@repo/database";
import { addDays, startOfUzDay, startOfUzMonth } from "@repo/shared";

export interface LowStockItem {
  id: string;
  productName: string;
  variantName: string;
  stock: number;
  minStock: number;
}

export interface RoleSummary {
  id: string;
  code: string;
  name: string;
  usersCount: number;
  permissionsCount: number;
}

export interface Overview {
  tenant: { name: string; slug: string; usdRate: number; createdAt: Date };
  counts: {
    stores: number;
    warehouses: number;
    products: number;
    variants: number;
    customers: number;
    employees: number;
    orders: number;
    permissions: number;
  };
  revenue30: number;
  grossProfit30: number;
  expensesMonth: number;
  receivables: number;
  payables: number;
  today: { orders: number; revenue: number };
  lowStock: LowStockItem[];
  roles: RoleSummary[];
}

export async function getOverview(tenantId: string): Promise<Overview> {
  return withTenantContext(tenantId, async (tx) => {
    const todayStart = startOfUzDay();
    const from30 = addDays(todayStart, -29);
    const monthStart = startOfUzMonth();

    const [
      tenant,
      stores,
      warehouses,
      products,
      variants,
      customers,
      employees,
      orders,
      permissions,
      revenue30,
      costItems,
      expensesMonth,
      receivablesAgg,
      payablesAgg,
      todayAgg,
      roles,
      lowStock,
    ] = await Promise.all([
      tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { name: true, slug: true, usdRate: true, createdAt: true },
      }),
      tx.store.count({ where: { tenantId } }),
      tx.warehouse.count({ where: { tenantId } }),
      tx.product.count({ where: { tenantId } }),
      tx.productVariant.count({ where: { tenantId } }),
      tx.customer.count({ where: { tenantId } }),
      tx.user.count({ where: { tenantId } }),
      tx.order.count({ where: { tenantId } }),
      tx.permission.count(),
      tx.order.aggregate({
        where: { tenantId, type: "SALE", status: "COMPLETED", createdAt: { gte: from30 } },
        _sum: { totalAmount: true },
      }),
      tx.orderItem.findMany({
        where: {
          tenantId,
          order: { type: "SALE", status: "COMPLETED", createdAt: { gte: from30 } },
        },
        select: { quantity: true, unitCost: true },
      }),
      tx.expense.aggregate({
        where: { tenantId, date: { gte: monthStart } },
        _sum: { amount: true },
      }),
      tx.debtRecord.aggregate({
        where: { tenantId, type: "RECEIVABLE", status: { in: ["OPEN", "PARTIAL", "OVERDUE"] } },
        _sum: { amount: true, paidAmount: true },
      }),
      tx.debtRecord.aggregate({
        where: { tenantId, type: "PAYABLE", status: { in: ["OPEN", "PARTIAL", "OVERDUE"] } },
        _sum: { amount: true, paidAmount: true },
      }),
      tx.order.aggregate({
        where: {
          tenantId,
          type: "SALE",
          status: "COMPLETED",
          createdAt: { gte: todayStart, lt: addDays(todayStart, 1) },
        },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      tx.role.findMany({
        where: { tenantId },
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          _count: { select: { users: true, permissions: true } },
        },
      }),
      tx.$queryRaw<LowStockItem[]>`
        SELECT
          pv.id,
          p.name AS "productName",
          pv.name AS "variantName",
          COALESCE(SUM(i.quantity), 0)::float8 AS stock,
          p."minStockAlert"::float8 AS "minStock"
        FROM "ProductVariant" pv
        JOIN "Product" p ON p.id = pv."productId"
        LEFT JOIN "Inventory" i ON i."variantId" = pv.id
        WHERE pv."tenantId" = ${tenantId} AND pv."isActive" = true AND p."isActive" = true
        GROUP BY pv.id, p.name, pv.name, p."minStockAlert"
        HAVING COALESCE(SUM(i.quantity), 0) <= p."minStockAlert"
        ORDER BY stock ASC
      `,
    ]);

    const revenue = Number(revenue30._sum.totalAmount ?? 0);
    const cogs = costItems.reduce(
      (acc, item) => acc + Number(item.quantity) * Number(item.unitCost),
      0,
    );

    return {
      tenant: {
        name: tenant.name,
        slug: tenant.slug,
        usdRate: Number(tenant.usdRate),
        createdAt: tenant.createdAt,
      },
      counts: {
        stores,
        warehouses,
        products,
        variants,
        customers,
        employees,
        orders,
        permissions,
      },
      revenue30: revenue,
      grossProfit30: revenue - cogs,
      expensesMonth: Number(expensesMonth._sum.amount ?? 0),
      receivables:
        Number(receivablesAgg._sum.amount ?? 0) - Number(receivablesAgg._sum.paidAmount ?? 0),
      payables: Number(payablesAgg._sum.amount ?? 0) - Number(payablesAgg._sum.paidAmount ?? 0),
      today: {
        orders: todayAgg._count._all,
        revenue: Number(todayAgg._sum.totalAmount ?? 0),
      },
      lowStock,
      roles: roles.map((role) => ({
        id: role.id,
        code: role.code,
        name: role.name,
        usersCount: role._count.users,
        permissionsCount: role._count.permissions,
      })),
    };
  });
}
