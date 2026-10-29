import { orderSchema } from "@repo/shared";
import { assertSameOrigin, handle, json, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { toSaleActor } from "@/lib/sales/actors";
import { createSale } from "@/lib/sales/engine";
import { listSales } from "@/lib/sales/receipts";
import { serializeOrder } from "@/lib/sales/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/orders — onlayn POS cheki.
 *
 * Ixtiyoriy `Idempotency-Key` header'i berilsa, tarmoq xatosidan keyingi
 * qayta yuborish ikkinchi chek yaratmaydi (offline sync bilan bir xil kafolat).
 */
export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const actor = await requirePermission("sales.create");
    const input = await parseBody(request, orderSchema);

    const headerKey = request.headers.get("idempotency-key")?.trim() || null;
    if (headerKey && (headerKey.length < 8 || headerKey.length > 100)) {
      throw new ApiError(422, "Idempotency-Key 8–100 belgidan iborat bo'lishi kerak.");
    }

    const result = await createSale({
      actor: toSaleActor(actor),
      input,
      clientOrderId: headerKey,
    });

    return json(
      {
        order: serializeOrder(result.order),
        duplicate: result.duplicate,
      },
      result.duplicate ? 200 : 201,
    );
  });
}

const ORDER_STATUSES = new Set(["DRAFT", "COMPLETED", "CANCELLED", "REFUNDED"]);
const PAYMENT_STATUSES = new Set(["PAID", "PARTIAL", "UNPAID", "REFUNDED"]);

function parseDate(value: string, label: string): Date {
  // Faqqat ISO 8601 yoki YYYY-MM-DD: V8 `17-mart` kabi satrlarni ham
  // o'zicha parse qilib olaveradi, shuning uchun shaklni oldindan tekshiramiz.
  const isIso = /^(\d{4}-\d{2}-\d{2})([T ][0-9:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(value);
  const date = isIso
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value.replace(" ", "T"))
    : null;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new ApiError(422, `${label} noto'g'ri sana (ISO 8601 yoki YYYY-MM-DD kerak).`);
  }
  return date;
}

/**
 * GET /api/v1/orders — cheklar jurnali (POS/desktop klientlar uchun).
 *
 * Filtrlalar: limit (1–100), offset, status, paymentStatus, customerId,
 * storeId, from, to. Kassir/offisant `settings.manage` ruxsatisiz faqat
 * o'z filialining cheklarini ko'radi.
 */
export async function GET(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const actor = await requirePermission("sales.view");
    const params = new URL(request.url).searchParams;

    const limitParam = Number(params.get("limit") ?? 50);
    const offsetParam = Number(params.get("offset") ?? 0);
    if (!Number.isInteger(limitParam) || limitParam < 1 || limitParam > 100) {
      throw new ApiError(422, "limit 1–100 oralig'ida butun son bo'lishi kerak.");
    }
    if (!Number.isInteger(offsetParam) || offsetParam < 0) {
      throw new ApiError(422, "offset 0 yoki undan katta butun son bo'lishi kerak.");
    }

    const status = params.get("status");
    if (status && !ORDER_STATUSES.has(status)) {
      throw new ApiError(422, "status: DRAFT | COMPLETED | CANCELLED | REFUNDED");
    }
    const paymentStatus = params.get("paymentStatus");
    if (paymentStatus && !PAYMENT_STATUSES.has(paymentStatus)) {
      throw new ApiError(422, "paymentStatus: PAID | PARTIAL | UNPAID | REFUNDED");
    }

    const canAnyStore = actor.permissions.includes("settings.manage");
    const requestedStore = params.get("storeId") || undefined;
    if (requestedStore && !canAnyStore && requestedStore !== actor.storeId) {
      throw new ApiError(403, "Boshqa filial cheklari faqat settings.manage ruxsati bilan ko'rinadi.");
    }

    const result = await listSales(actor.tenantId, {
      limit: limitParam,
      offset: offsetParam,
      status: status || undefined,
      paymentStatus: paymentStatus || undefined,
      customerId: params.get("customerId") || undefined,
      storeId: canAnyStore ? requestedStore : actor.storeId ?? undefined,
      from: params.get("from") ? parseDate(params.get("from")!, "from") : undefined,
      to: params.get("to") ? parseDate(params.get("to")!, "to") : undefined,
    });

    return json(result);
  });
}
