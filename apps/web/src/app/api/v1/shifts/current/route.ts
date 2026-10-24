import { handle, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getCurrentShift } from "@/lib/sales/shifts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/shifts/current — joriy ochiq smena va jonli X-hisobot. */
export async function GET() {
  return handle(async () => {
    const actor = await requireUser();
    const shift = await getCurrentShift({ tenantId: actor.tenantId, userId: actor.id });
    return json({ shift });
  });
}
