import type { SessionUser } from "@/lib/types";
import type { SaleActor } from "./engine";
import type { ShiftActor } from "./shifts";

export function toSaleActor(user: SessionUser): SaleActor {
  return {
    tenantId: user.tenantId,
    userId: user.id,
    permissions: user.permissions,
  };
}

export function toShiftActor(user: SessionUser): ShiftActor {
  return {
    tenantId: user.tenantId,
    userId: user.id,
    storeId: user.storeId,
    permissions: user.permissions,
  };
}
