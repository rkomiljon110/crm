import { Prisma, withTenantContext, type TenantTx } from "@repo/database";
import { SalesError } from "./errors";
import { serializeShift, type ShiftTotalsView, type ShiftViewInput } from "./serializers";

export interface ShiftActor {
  tenantId: string;
  userId: string;
  storeId: string | null;
  permissions: readonly string[];
}

export interface OpenShiftInput {
  storeId: string;
  openingCash: number;
  note?: string;
}

export interface CloseShiftInput {
  shiftId: string;
  closingCash: number;
  note?: string;
}

const shiftInclude = {
  store: { select: { id: true, code: true, name: true } },
} satisfies Prisma.CashShiftInclude;

type ShiftWithStore = Prisma.CashShiftGetPayload<{ include: typeof shiftInclude }>;

interface ShiftLockRow {
  id: string;
  storeId: string;
  userId: string;
  status: string;
  openingCash: Prisma.Decimal;
  note: string | null;
}

function dec(value: Prisma.Decimal | string | number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

/**
 * Smena bo'yicha tushumni yagona manbadan hisoblaydi:
 * cheklar (total/debt/paid) + PaymentTransaction (naqd/karta/o'tkazma/boshqa).
 * X-hisobot ham, Z-hisobot (yopish) ham shu funksiyadan foydalanadi.
 */
export async function computeShiftTotals(
  tx: TenantTx,
  shift: { id: string; tenantId: string; openingCash: Prisma.Decimal },
): Promise<ShiftTotalsView> {
  const [orders, payments] = await Promise.all([
    tx.order.aggregate({
      where: {
        tenantId: shift.tenantId,
        shiftId: shift.id,
        status: "COMPLETED",
        type: "SALE",
      },
      _count: { _all: true },
      _sum: { totalAmount: true, paidAmount: true, debtAmount: true },
    }),
    tx.paymentTransaction.groupBy({
      by: ["method"],
      where: {
        tenantId: shift.tenantId,
        status: "COMPLETED",
        order: { shiftId: shift.id },
      },
      _sum: { amount: true },
    }),
  ]);

  let totalCash = 0;
  let totalCard = 0;
  let totalTransfer = 0;
  let totalOther = 0;

  for (const group of payments) {
    const amount = Number(group._sum.amount ?? 0);
    switch (group.method) {
      case "CASH":
        totalCash += amount;
        break;
      case "CARD":
        totalCard += amount;
        break;
      case "TRANSFER":
        totalTransfer += amount;
        break;
      default:
        totalOther += amount;
    }
  }

  const openingCash = Number(shift.openingCash);

  return {
    salesCount: orders._count._all,
    totalCash,
    totalCard,
    totalTransfer,
    totalOther,
    totalDebt: Number(orders._sum.debtAmount ?? 0),
    totalSales: Number(orders._sum.totalAmount ?? 0),
    totalPaid: Number(orders._sum.paidAmount ?? 0),
    expectedCash: openingCash + totalCash,
  };
}

function zeroTotals(openingCash: number): ShiftTotalsView {
  return {
    salesCount: 0,
    totalCash: 0,
    totalCard: 0,
    totalTransfer: 0,
    totalOther: 0,
    totalDebt: 0,
    totalSales: 0,
    totalPaid: 0,
    expectedCash: openingCash,
  };
}

export function serializeCurrentShift(shift: ShiftWithStore, totals: ShiftTotalsView) {
  return serializeShift(shift as ShiftViewInput, totals);
}

/** Kassa smenasini ochadi. Bir foydalanuvchida bir vaqtda bitta ochiq smena. */
export async function openShift(actor: ShiftActor, input: OpenShiftInput) {
  return withTenantContext(actor.tenantId, async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${`shift-open:${actor.tenantId}:${input.storeId}:${actor.userId}`}, 0))) AS lock`,
    );

    const store = await tx.store.findFirst({
      where: { id: input.storeId, tenantId: actor.tenantId, isActive: true },
      select: { id: true, name: true, code: true },
    });
    if (!store) {
      throw new SalesError(404, "STORE_NOT_FOUND", "Filial topilmadi yoki faol emas.");
    }

    const canUseAnyStore = actor.permissions.includes("settings.manage");
    if (actor.storeId && actor.storeId !== store.id && !canUseAnyStore) {
      throw new SalesError(403, "STORE_FORBIDDEN", "Faqat o'z filialingizda smena ochishingiz mumkin.");
    }

    const existing = await tx.cashShift.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId, status: "OPEN" },
      select: { id: true, storeId: true },
    });
    if (existing) {
      throw new SalesError(409, "SHIFT_ALREADY_OPEN", "Sizda allaqachon ochiq smena bor.", {
        shiftId: existing.id,
        storeId: existing.storeId,
      });
    }

    const shift = await tx.cashShift.create({
      data: {
        tenantId: actor.tenantId,
        storeId: store.id,
        userId: actor.userId,
        openingCash: dec(input.openingCash),
        note: input.note ?? null,
      },
      include: shiftInclude,
    });

    await tx.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: "SHIFT_OPEN",
        entityType: "CashShift",
        entityId: shift.id,
        after: { storeId: store.id, openingCash: Number(shift.openingCash) },
      },
    });

    return serializeShift(shift as ShiftViewInput, zeroTotals(Number(shift.openingCash)));
  });
}

/** Smenani yopadi va naqd farqini yozadi (Z-hisobot). */
export async function closeShift(actor: ShiftActor, input: CloseShiftInput) {
  return withTenantContext(actor.tenantId, async (tx) => {
    // FOR UPDATE: yopish paytida yangi chek yozilib qolmasligi kafolatlanadi.
    const rows = await tx.$queryRaw<ShiftLockRow[]>(Prisma.sql`
      SELECT "id", "storeId", "userId", "status", "openingCash", "note"
      FROM "CashShift"
      WHERE "id" = ${input.shiftId}
        AND "tenantId" = ${actor.tenantId}
      FOR UPDATE
    `);
    const shift = rows[0];
    if (!shift) {
      throw new SalesError(404, "SHIFT_NOT_FOUND", "Smena topilmadi.");
    }
    if (shift.status !== "OPEN") {
      throw new SalesError(409, "SHIFT_ALREADY_CLOSED", "Smena allaqachon yopilgan.");
    }

    const canCloseAny = actor.permissions.includes("settings.manage");
    if (shift.userId !== actor.userId && !canCloseAny) {
      throw new SalesError(403, "SHIFT_FORBIDDEN", "Boshqa kassirning smenasini yopa olmaysiz.");
    }

    const totals = await computeShiftTotals(tx, {
      id: shift.id,
      tenantId: actor.tenantId,
      openingCash: dec(shift.openingCash),
    });

    const closingCash = dec(input.closingCash).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const expected = dec(shift.openingCash).plus(totals.totalCash);
    const difference = closingCash.minus(expected);

    const note = [shift.note, input.note].filter(Boolean).join(" | ") || null;

    const updated = await tx.cashShift.update({
      where: { id: shift.id },
      data: {
        status: "CLOSED",
        closingCash,
        expectedCash: expected,
        difference,
        salesCount: totals.salesCount,
        totalCash: totals.totalCash,
        totalCard: totals.totalCard,
        totalTransfer: totals.totalTransfer,
        totalOther: totals.totalOther,
        totalDebt: totals.totalDebt,
        note,
        closedAt: new Date(),
      },
      include: shiftInclude,
    });

    await tx.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: "SHIFT_CLOSE",
        entityType: "CashShift",
        entityId: shift.id,
        after: {
          salesCount: totals.salesCount,
          openingCash: Number(shift.openingCash),
          totalCash: totals.totalCash,
          totalCard: totals.totalCard,
          totalTransfer: totals.totalTransfer,
          totalOther: totals.totalOther,
          totalDebt: totals.totalDebt,
          closingCash: Number(closingCash),
          expectedCash: Number(expected),
          difference: Number(difference),
        },
      },
    });

    return serializeShift(updated as ShiftViewInput, totals);
  });
}

/** Joriy ochiq smena va jonli X-hisobot. Smena bo'lmasa `null`. */
export async function getCurrentShift(actor: { tenantId: string; userId: string }) {
  return withTenantContext(actor.tenantId, async (tx) => {
    const shift = await tx.cashShift.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId, status: "OPEN" },
      orderBy: { openedAt: "desc" },
      include: shiftInclude,
    });
    if (!shift) return null;

    const totals = await computeShiftTotals(tx, {
      id: shift.id,
      tenantId: actor.tenantId,
      openingCash: shift.openingCash,
    });
    return serializeShift(shift as ShiftViewInput, totals);
  });
}
