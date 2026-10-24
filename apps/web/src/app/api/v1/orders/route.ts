import { orderSchema } from "@repo/shared";
import { assertSameOrigin, handle, json, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { toSaleActor } from "@/lib/sales/actors";
import { createSale } from "@/lib/sales/engine";
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
