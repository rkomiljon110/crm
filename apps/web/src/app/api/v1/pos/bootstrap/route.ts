import { handle, json } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { getPosBootstrap } from "@/lib/pos/bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/pos/bootstrap?warehouseId=&q=
 *
 * POS uchun real bootstrap: joriy smena, omborlar, shtrix-kod yoki nom
 * bo'yicha qidiruv natijalari va nasiya mijozlari.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const user = await requirePermission("pos.use");
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() || undefined;
    const warehouseId = url.searchParams.get("warehouseId")?.trim() || undefined;

    if (q && q.length > 100) {
      throw new ApiError(422, "Qidiruv matni 100 belgidan oshmasin.");
    }
    if (warehouseId && (warehouseId.length < 8 || warehouseId.length > 64)) {
      throw new ApiError(422, "warehouseId formati noto'g'ri.");
    }

    const context = await getPosBootstrap(user, { q, warehouseId });
    return json(context);
  });
}
