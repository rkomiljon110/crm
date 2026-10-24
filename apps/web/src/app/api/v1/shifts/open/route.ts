import { shiftOpenSchema } from "@repo/shared";
import { assertSameOrigin, handle, json, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { toShiftActor } from "@/lib/sales/actors";
import { openShift } from "@/lib/sales/shifts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const actor = await requirePermission("shifts.manage");
    const input = await parseBody(request, shiftOpenSchema);
    const shift = await openShift(toShiftActor(actor), input);
    return json({ shift }, 201);
  });
}
