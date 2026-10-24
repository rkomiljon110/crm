import { syncBatchSchema, type SyncOrderResult } from "@repo/shared";
import { assertSameOrigin, handle, json, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { toSaleActor } from "@/lib/sales/actors";
import { createSale } from "@/lib/sales/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/sync/orders — offline kassa cheklari to'plamini qabul qiladi.
 *
 * Har bir chek o'z PostgreSQL tranzaksiyasida ishlanadi. Bittasi xato bersa
 * qolganlari davom etadi (partial success). Bir xil `clientOrderId` qayta
 * yuborilsa, yangi chek yaratilmaydi — `skipped_duplicate` qaytadi.
 */
export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const actor = await requirePermission("sales.create");
    const batch = await parseBody(request, syncBatchSchema);
    const saleActor = toSaleActor(actor);

    const results: SyncOrderResult[] = [];

    for (const order of batch.orders) {
      try {
        const result = await createSale({
          actor: saleActor,
          input: order,
          clientOrderId: order.clientOrderId,
        });

        results.push({
          clientOrderId: order.clientOrderId,
          status: result.duplicate ? "skipped_duplicate" : "processed",
          orderId: result.order.id,
          orderNumber: result.order.number,
          totalAmount: Number(result.order.totalAmount),
        });
      } catch (error) {
        if (error instanceof ApiError) {
          results.push({
            clientOrderId: order.clientOrderId,
            status: "failed",
            code: error.code ?? "ORDER_FAILED",
            error: error.message,
          });
        } else {
          console.error("[sync/orders] kutilmagan xato:", error);
          results.push({
            clientOrderId: order.clientOrderId,
            status: "failed",
            code: "ORDER_FAILED",
            error: "Chekni saqlashda server xatosi. Qayta urinib ko'ring.",
          });
        }
      }
    }

    const processed = results.filter((result) => result.status === "processed").length;
    const skippedDuplicate = results.filter((result) => result.status === "skipped_duplicate").length;
    const failed = results.filter((result) => result.status === "failed").length;

    return json({
      deviceId: batch.deviceId,
      serverTime: new Date().toISOString(),
      summary: {
        total: results.length,
        processed,
        skippedDuplicate,
        failed,
      },
      results,
    });
  });
}
