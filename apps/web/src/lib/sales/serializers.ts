import { Prisma } from "@repo/database";

/** Order bilan birga qaytariladigan relationlar (bitta joyda belgilangan) */
export const orderInclude = {
  items: { orderBy: { id: "asc" } },
  payments: { orderBy: { createdAt: "asc" } },
  customer: { select: { id: true, name: true, phone: true } },
  store: { select: { id: true, code: true, name: true } },
  shift: { select: { id: true, status: true } },
} satisfies Prisma.OrderInclude;

export type OrderWithDetails = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

function money(value: Prisma.Decimal | number | string | null | undefined): number {
  return Number(value ?? 0);
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/**
 * Chekni API javobiga aylantiradi.
 * `unitCost` ataylab qaytarilmaydi: tannarx faqat `products.viewCost`
 * ruxsati bilan alohida hisobot endpointida beriladi.
 */
export function serializeOrder(order: OrderWithDetails) {
  return {
    id: order.id,
    number: order.number,
    type: order.type,
    status: order.status,
    store: order.store,
    warehouseId: order.warehouseId,
    shiftId: order.shiftId,
    shiftStatus: order.shift?.status ?? null,
    cashierId: order.cashierId,
    customer: order.customer,
    subtotal: money(order.subtotal),
    discountAmount: money(order.discountAmount),
    taxAmount: money(order.taxAmount),
    totalAmount: money(order.totalAmount),
    paidAmount: money(order.paidAmount),
    debtAmount: money(order.debtAmount),
    paymentStatus: order.paymentStatus,
    dueDate: iso(order.dueDate),
    note: order.note,
    offlineId: order.offlineId,
    clientCreatedAt: iso(order.clientCreatedAt),
    createdAt: order.createdAt.toISOString(),
    completedAt: iso(order.completedAt),
    items: order.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      productName: item.productName,
      variantName: item.variantName,
      quantity: Number(item.quantity),
      unitPrice: money(item.unitPrice),
      discountAmount: money(item.discountAmount),
      subtotal: money(item.subtotal),
      taxAmount: money(item.taxAmount),
    })),
    payments: order.payments.map((payment) => ({
      id: payment.id,
      method: payment.method,
      amount: money(payment.amount),
      status: payment.status,
      provider: payment.provider,
      providerRef: payment.providerRef,
      createdAt: payment.createdAt.toISOString(),
    })),
  };
}

export interface ShiftTotalsView {
  salesCount: number;
  totalCash: number;
  totalCard: number;
  totalTransfer: number;
  totalOther: number;
  totalDebt: number;
  totalSales: number;
  totalPaid: number;
  expectedCash: number;
}

export interface ShiftViewInput {
  id: string;
  status: string;
  storeId: string;
  userId: string;
  openingCash: Prisma.Decimal;
  closingCash: Prisma.Decimal | null;
  expectedCash: Prisma.Decimal | null;
  difference: Prisma.Decimal | null;
  salesCount: number;
  note: string | null;
  openedAt: Date;
  closedAt: Date | null;
  store?: { id: string; code: string; name: string } | null;
}

export function serializeShift(shift: ShiftViewInput, totals: ShiftTotalsView) {
  return {
    id: shift.id,
    status: shift.status,
    storeId: shift.storeId,
    store: shift.store ?? null,
    userId: shift.userId,
    openingCash: money(shift.openingCash),
    closingCash: shift.closingCash === null ? null : money(shift.closingCash),
    expectedCash: totals.expectedCash,
    difference: shift.difference === null ? null : money(shift.difference),
    salesCount: totals.salesCount,
    totals: {
      cash: totals.totalCash,
      card: totals.totalCard,
      transfer: totals.totalTransfer,
      other: totals.totalOther,
      debt: totals.totalDebt,
      sales: totals.totalSales,
      paid: totals.totalPaid,
    },
    note: shift.note,
    openedAt: shift.openedAt.toISOString(),
    closedAt: iso(shift.closedAt),
  };
}
