import { withTenantContext } from "@repo/database";

/** Chekni chop etish uchun to'liq buyurtma (tenant bilan cheklangan). */
export async function getReceiptOrder(tenantId: string, orderId: string) {
  return withTenantContext(tenantId, async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        items: { orderBy: { id: "asc" } },
        payments: { orderBy: { createdAt: "asc" } },
        customer: { select: { name: true, phone: true } },
        store: { select: { name: true, code: true, address: true, phone: true } },
        cashier: { select: { name: true } },
        tenant: { select: { name: true, inn: true, phone: true } },
      },
    });
    if (!order) return null;

    return {
      id: order.id,
      number: order.number,
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt.toISOString(),
      customer: order.customer,
      store: order.store,
      cashier: order.cashier,
      tenant: order.tenant,
      subtotal: Number(order.subtotal),
      discountAmount: Number(order.discountAmount),
      taxAmount: Number(order.taxAmount),
      totalAmount: Number(order.totalAmount),
      paidAmount: Number(order.paidAmount),
      debtAmount: Number(order.debtAmount),
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        variantName: item.variantName,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discountAmount: Number(item.discountAmount),
        subtotal: Number(item.subtotal),
      })),
      payments: order.payments.map((payment) => ({
        id: payment.id,
        method: payment.method,
        amount: Number(payment.amount),
        status: payment.status,
      })),
    };
  });
}

export type ReceiptOrder = NonNullable<Awaited<ReturnType<typeof getReceiptOrder>>>;

/** Oxirgi cheklar ro'yxati — savdolar sahifasi va qayta chop etish uchun. */
export async function getRecentSales(tenantId: string, take = 50) {
  return withTenantContext(tenantId, async (tx) => {
    const orders = await tx.order.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        number: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        debtAmount: true,
        createdAt: true,
        customer: { select: { name: true } },
        store: { select: { name: true } },
        _count: { select: { items: true } },
      },
    });

    return orders.map((order) => ({
      id: order.id,
      number: order.number,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: Number(order.totalAmount),
      debtAmount: Number(order.debtAmount),
      createdAt: order.createdAt.toISOString(),
      customer: order.customer,
      store: order.store,
      itemsCount: order._count.items,
    }));
  });
}
