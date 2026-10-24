import { Prisma, withTenantContext } from "@repo/database";
import {
  calculateSaleTotals,
  moneyToMinor,
  toUzDateKey,
  type OrderInput,
  type PosPaymentMethod,
} from "@repo/shared";
import { SalesError } from "./errors";
import { orderInclude, type OrderWithDetails } from "./serializers";

/** Oflayn navbatda juda eski chekni qabul qilmaymiz (hisobot davri buzilmasin). */
const MAX_OFFLINE_AGE_MS = 180 * 24 * 60 * 60 * 1000;
/** Klient soati serverdan 5 daqiqadan ko'proq oldinga ketmasin. */
const MAX_FUTURE_DRIFT_MS = 5 * 60 * 1000;

export interface SaleActor {
  tenantId: string;
  userId: string;
  permissions: readonly string[];
}

export interface CreateSaleInput {
  actor: SaleActor;
  input: OrderInput;
  /** Offline chek UUIDsi; berilsa idempotentlik kafolati ishlaydi. */
  clientOrderId?: string | null;
}

export interface SaleResult {
  order: OrderWithDetails;
  duplicate: boolean;
}

interface ShiftRow {
  id: string;
  storeId: string;
  userId: string;
  openingCash: Prisma.Decimal;
  status: string;
}

function dec(value: Prisma.Decimal | string | number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function round2(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function fromMinor(minor: number): Prisma.Decimal {
  return new Prisma.Decimal(minor).div(100);
}

/**
 * Savdo chekini bitta PostgreSQL tranzaksiyasida yaratadi:
 * qoldiqni atomik kamaytirish → Order + OrderItem → to'lovlar → qarz →
 * StockMovementLog → AuditLog.
 *
 * Birorta qadam xato bersa butun tranzaksiya rollback bo'ladi; qoldiq hech
 * qachon manfiyga tushmaydi va chek yarim holatda qolmaydi.
 */
export async function createSale({ actor, input, clientOrderId }: CreateSaleInput): Promise<SaleResult> {
  if (input.type !== "SALE") {
    throw new SalesError(
      400,
      "RETURN_UNSUPPORTED",
      "Qaytarish (RETURN) 4-bosqichda alohida refund oqimi orqali amalga oshiriladi.",
    );
  }
  if (input.items.length === 0) {
    throw new SalesError(400, "EMPTY_ORDER", "Savat bo'sh.");
  }

  const variantIds = input.items.map((item) => item.variantId);
  if (new Set(variantIds).size !== variantIds.length) {
    throw new SalesError(
      422,
      "DUPLICATE_ITEM",
      "Bitta tovar chekda ikki marta takrorlangan. Miqdorni birlashtiring.",
    );
  }

  const hasDiscount =
    input.discountAmount > 0 || input.items.some((item) => (item.discountAmount ?? 0) > 0);
  if (hasDiscount && !actor.permissions.includes("pos.discount")) {
    throw new SalesError(403, "DISCOUNT_FORBIDDEN", "Chegirma berish uchun ruxsatingiz yo'q.");
  }

  for (const item of input.items) {
    const gross = dec(item.quantity).mul(item.unitPrice);
    if (dec(item.discountAmount ?? 0).gt(gross)) {
      throw new SalesError(422, "INVALID_DISCOUNT", "Qator chegirmasi summasidan katta bo'lishi mumkin emas.");
    }
  }

  const totals = calculateSaleTotals(input.items, input.discountAmount, input.taxAmount);
  const subtotalMinor = moneyToMinor(totals.subtotal);
  if (moneyToMinor(input.discountAmount) > subtotalMinor) {
    throw new SalesError(422, "INVALID_DISCOUNT", "Chek chegirmasi umumiy summasidan katta.");
  }

  const paidMinor = input.payments
    .filter((payment) => payment.method !== "DEBT")
    .reduce((sum, payment) => sum + moneyToMinor(payment.amount), 0);
  const debtMinor = input.payments
    .filter((payment) => payment.method === "DEBT")
    .reduce((sum, payment) => sum + moneyToMinor(payment.amount), 0);
  const totalMinor = moneyToMinor(totals.totalAmount);

  if (paidMinor + debtMinor !== totalMinor) {
    throw new SalesError(
      422,
      "PAYMENT_MISMATCH",
      "To'lov summasi chek summasiga teng emas.",
      {
        expected: totals.totalAmount,
        paid: paidMinor / 100,
        debt: debtMinor / 100,
      },
    );
  }

  if (debtMinor > 0 && !input.customerId) {
    throw new SalesError(422, "CUSTOMER_REQUIRED", "Nasiya savdo uchun mijoz tanlanishi shart.");
  }

  const now = new Date();
  const saleDate = input.clientCreatedAt ? new Date(input.clientCreatedAt) : now;
  if (Number.isNaN(saleDate.getTime())) {
    throw new SalesError(422, "INVALID_CLIENT_DATE", "clientCreatedAt noto'g'ri sana.");
  }
  if (saleDate.getTime() - now.getTime() > MAX_FUTURE_DRIFT_MS) {
    throw new SalesError(422, "INVALID_CLIENT_DATE", "Chek sanasi kelajakda bo'lishi mumkin emas.");
  }
  if (now.getTime() - saleDate.getTime() > MAX_OFFLINE_AGE_MS) {
    throw new SalesError(
      422,
      "INVALID_CLIENT_DATE",
      "Chek 180 kundan eski. Qo'lda tekshirib, yangi chek sifatida kiriting.",
    );
  }

  return withTenantContext(
    actor.tenantId,
    async (tx) => {
      // ── Idempotentlik: bir xil clientOrderId ikki marta ishlanmaydi ──────
      if (clientOrderId) {
        await tx.$queryRaw(
          Prisma.sql`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${`order:${actor.tenantId}:${clientOrderId}`}, 0))) AS lock`,
        );
        const existing = await tx.order.findUnique({
          where: { tenantId_offlineId: { tenantId: actor.tenantId, offlineId: clientOrderId } },
          include: orderInclude,
        });
        if (existing) {
          return { order: existing, duplicate: true };
        }
      }

      // ── Ochiq smena (FOR SHARE: smena yopilishi bilan poyga bo'lmaydi) ──
      const shifts = await tx.$queryRaw<ShiftRow[]>(Prisma.sql`
        SELECT "id", "storeId", "userId", "openingCash", "status"
        FROM "CashShift"
        WHERE "tenantId" = ${actor.tenantId}
          AND "userId" = ${actor.userId}
          AND "status" = 'OPEN'
        ORDER BY "openedAt" DESC
        LIMIT 1
        FOR SHARE
      `);
      const shift = shifts[0];
      if (!shift) {
        throw new SalesError(
          400,
          "SHIFT_REQUIRED",
          "Savdo qilishdan oldin kassa smenasini oching.",
        );
      }
      if (input.storeId && input.storeId !== shift.storeId) {
        throw new SalesError(
          422,
          "STORE_MISMATCH",
          "Chek filiali ochiq smena filialiga mos emas.",
          { shiftStoreId: shift.storeId, requestedStoreId: input.storeId },
        );
      }

      const store = await tx.store.findFirst({
        where: { id: shift.storeId, tenantId: actor.tenantId },
        select: { id: true, code: true, name: true },
      });
      if (!store) {
        throw new SalesError(404, "STORE_NOT_FOUND", "Smena filiali topilmadi.");
      }

      const warehouse = await tx.warehouse.findFirst({
        where: { id: input.warehouseId, tenantId: actor.tenantId },
        select: { id: true, storeId: true, name: true, isActive: true },
      });
      if (!warehouse || !warehouse.isActive) {
        throw new SalesError(404, "WAREHOUSE_NOT_FOUND", "Ombor topilmadi yoki faol emas.");
      }
      if (warehouse.storeId && warehouse.storeId !== shift.storeId) {
        throw new SalesError(
          422,
          "WAREHOUSE_MISMATCH",
          "Tanlangan ombor smena filialiga tegishli emas.",
        );
      }

      // ── Mijoz (faqat nasiya uchun majburiy) ─────────────────────────────
      const customer = input.customerId
        ? await tx.customer.findFirst({
            where: { id: input.customerId, tenantId: actor.tenantId },
            select: {
              id: true,
              name: true,
              isBlocked: true,
              debtBalance: true,
              maxDebtLimit: true,
            },
          })
        : null;
      if (input.customerId && !customer) {
        throw new SalesError(404, "CUSTOMER_NOT_FOUND", "Mijoz topilmadi.");
      }

      // ── Tovar snapshotlari (nom, tannarx) ───────────────────────────────
      const variants = await tx.productVariant.findMany({
        where: { tenantId: actor.tenantId, id: { in: variantIds } },
        select: {
          id: true,
          name: true,
          costPrice: true,
          isActive: true,
          product: { select: { name: true, isActive: true } },
        },
      });
      const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
      const missing = variantIds.filter((id) => !variantMap.has(id));
      if (missing.length > 0) {
        throw new SalesError(404, "VARIANT_NOT_FOUND", "Ba'zi tovarlar topilmadi.", { missing });
      }
      for (const id of variantIds) {
        const variant = variantMap.get(id)!;
        if (!variant.isActive || !variant.product.isActive) {
          throw new SalesError(422, "VARIANT_INACTIVE", `"${variant.product.name}" sotuvdan chiqarilgan.`);
        }
      }

      // ── Qoldiqni atomik kamaytirish ─────────────────────────────────────
      // WHERE quantity >= qaytarilgan miqdor sharti UPDATE ichida bajariladi:
      // parallel so'rovlar bir qatorga navbat bilan kiradi va oversell bo'lmaydi.
      // Variantlar ID bo'yicha tartiblanadi — ko'p qatorli deadlock oldini oladi.
      const stockItems = [...input.items].sort((a, b) => a.variantId.localeCompare(b.variantId));
      for (const item of stockItems) {
        const updated = await tx.inventory.updateMany({
          where: {
            tenantId: actor.tenantId,
            warehouseId: warehouse.id,
            variantId: item.variantId,
            quantity: { gte: item.quantity },
          },
          data: { quantity: { decrement: item.quantity } },
        });

        if (updated.count !== 1) {
          const current = await tx.inventory.findFirst({
            where: {
              tenantId: actor.tenantId,
              warehouseId: warehouse.id,
              variantId: item.variantId,
            },
            select: { quantity: true },
          });
          const variant = variantMap.get(item.variantId)!;
          throw new SalesError(
            409,
            "INSUFFICIENT_STOCK",
            `"${variant.product.name}" uchun qoldiq yetarli emas.`,
            {
              variantId: item.variantId,
              productName: variant.product.name,
              requested: item.quantity,
              available: current ? Number(current.quantity) : 0,
            },
          );
        }
      }

      // ── Chek raqami: global sequence, tranzaksiyani bloklamaydi ─────────
      const [sequenceRow] = await tx.$queryRaw<Array<{ value: bigint | number | string }>>(
        Prisma.sql`SELECT nextval('"Order_number_seq"') AS value`,
      );
      const sequence = Number(sequenceRow?.value ?? 0);
      const dateKey = toUzDateKey(saleDate).slice(2).replace(/-/g, "");
      const number = `${store.code}-${dateKey}-${String(sequence).padStart(5, "0")}`;

      // ── Summalar (Decimal, 2 xona) ──────────────────────────────────────
      const orderItemsData = input.items.map((item) => {
        const variant = variantMap.get(item.variantId)!;
        const quantity = dec(item.quantity);
        const unitPrice = dec(item.unitPrice);
        const discountAmount = dec(item.discountAmount ?? 0);
        return {
          tenantId: actor.tenantId,
          variantId: item.variantId,
          productName: variant.product.name,
          variantName: variant.name,
          quantity,
          unitPrice,
          unitCost: variant.costPrice,
          discountAmount,
          subtotal: round2(quantity.mul(unitPrice).minus(discountAmount)),
        };
      });

      const subtotal = orderItemsData.reduce((sum, item) => sum.plus(item.subtotal), dec(0));
      const orderDiscount = round2(dec(input.discountAmount));
      const taxAmount = round2(dec(input.taxAmount));
      const totalAmount = round2(subtotal.minus(orderDiscount).plus(taxAmount));
      const paidAmount = fromMinor(paidMinor);
      const debtAmount = fromMinor(debtMinor);
      const paymentStatus = debtMinor === 0 ? "PAID" : paidMinor === 0 ? "UNPAID" : "PARTIAL";
      const dueDate = input.dueDate ? new Date(input.dueDate) : null;

      const order = await tx.order.create({
        data: {
          tenantId: actor.tenantId,
          number,
          type: "SALE",
          status: "COMPLETED",
          storeId: shift.storeId,
          warehouseId: warehouse.id,
          shiftId: shift.id,
          cashierId: actor.userId,
          customerId: customer?.id ?? null,
          subtotal,
          discountAmount: orderDiscount,
          taxAmount,
          totalAmount,
          paidAmount,
          debtAmount,
          paymentStatus,
          dueDate,
          note: input.note ?? null,
          offlineId: clientOrderId ?? null,
          clientCreatedAt: input.clientCreatedAt ? saleDate : null,
          createdAt: saleDate,
          completedAt: saleDate,
        },
      });

      await tx.orderItem.createMany({
        data: orderItemsData.map((item) => ({ ...item, orderId: order.id })),
      });

      const realPayments = input.payments.filter((payment) => payment.method !== "DEBT");
      if (realPayments.length > 0) {
        await tx.paymentTransaction.createMany({
          data: realPayments.map((payment) => ({
            tenantId: actor.tenantId,
            orderId: order.id,
            method: payment.method as Exclude<PosPaymentMethod, "DEBT">,
            amount: dec(payment.amount),
            status: "COMPLETED" as const,
            provider: payment.provider ?? null,
            providerRef: payment.providerRef ?? null,
            receivedById: actor.userId,
            createdAt: saleDate,
          })),
        });
      }

      await tx.stockMovementLog.createMany({
        data: input.items.map((item) => ({
          tenantId: actor.tenantId,
          warehouseId: warehouse.id,
          variantId: item.variantId,
          type: "SALE" as const,
          quantity: dec(item.quantity).negated(),
          unitCost: variantMap.get(item.variantId)!.costPrice,
          referenceType: "Order",
          referenceId: order.id,
          reason: clientOrderId ? "Offline sync savdosi" : "POS savdosi",
          userId: actor.userId,
          createdAt: saleDate,
        })),
      });

      // ── Nasiya: limitni atomik tekshirish va balansni oshirish ──────────
      if (debtMinor > 0 && customer) {
        if (customer.isBlocked) {
          throw new SalesError(403, "CUSTOMER_BLOCKED", "Mijoz bloklangan — nasiyaga savdo taqiqlangan.");
        }

        const limit = new Prisma.Decimal(customer.maxDebtLimit);
        const where: Prisma.CustomerWhereInput = {
          id: customer.id,
          tenantId: actor.tenantId,
          isBlocked: false,
        };
        if (limit.gt(0)) {
          where.debtBalance = { lte: limit.minus(debtAmount) };
        }

        const updated = await tx.customer.updateMany({
          where,
          data: { debtBalance: { increment: debtAmount } },
        });

        if (updated.count !== 1) {
          const fresh = await tx.customer.findFirst({
            where: { id: customer.id, tenantId: actor.tenantId },
            select: { isBlocked: true, debtBalance: true, maxDebtLimit: true },
          });
          if (fresh?.isBlocked) {
            throw new SalesError(403, "CUSTOMER_BLOCKED", "Mijoz bloklangan — nasiyaga savdo taqiqlangan.");
          }
          throw new SalesError(
            409,
            "CREDIT_LIMIT_EXCEEDED",
            "Mijozning nasiya limiti yetarli emas.",
            {
              debtBalance: fresh ? Number(fresh.debtBalance) : null,
              maxDebtLimit: fresh ? Number(fresh.maxDebtLimit) : null,
              requested: Number(debtAmount),
            },
          );
        }

        await tx.debtRecord.create({
          data: {
            tenantId: actor.tenantId,
            type: "RECEIVABLE",
            orderId: order.id,
            customerId: customer.id,
            amount: debtAmount,
            dueDate,
            status: dueDate && dueDate.getTime() < now.getTime() ? "OVERDUE" : "OPEN",
            description: `Chek ${number} bo'yicha nasiya`,
            createdAt: saleDate,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          userId: actor.userId,
          action: "CREATE",
          entityType: "Order",
          entityId: order.id,
          after: {
            number,
            shiftId: shift.id,
            storeId: shift.storeId,
            totalAmount: Number(totalAmount),
            paidAmount: Number(paidAmount),
            debtAmount: Number(debtAmount),
            itemCount: input.items.length,
            methods: Array.from(new Set(input.payments.map((payment) => payment.method))),
            source: clientOrderId ? "offline" : "online",
          },
        },
      });

      const created = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderInclude,
      });

      return { order: created, duplicate: false };
    },
    { timeout: 20_000, maxWait: 10_000 },
  );
}
