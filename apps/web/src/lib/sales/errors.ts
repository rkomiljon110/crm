import { ApiError } from "@/lib/errors";

/**
 * Savdo domen xatolari. `code` klientga mashina o'qiydigan tarzda qaytadi
 * (POS xatoni shu kod bo'yicha ko'rsatadi, sync esa shu kodni saqlaydi).
 */
export type SalesErrorCode =
  | "SHIFT_REQUIRED"
  | "SHIFT_ALREADY_OPEN"
  | "SHIFT_NOT_FOUND"
  | "SHIFT_ALREADY_CLOSED"
  | "SHIFT_FORBIDDEN"
  | "STORE_REQUIRED"
  | "STORE_NOT_FOUND"
  | "STORE_FORBIDDEN"
  | "STORE_MISMATCH"
  | "WAREHOUSE_NOT_FOUND"
  | "WAREHOUSE_MISMATCH"
  | "CUSTOMER_NOT_FOUND"
  | "CUSTOMER_REQUIRED"
  | "CUSTOMER_BLOCKED"
  | "CREDIT_LIMIT_EXCEEDED"
  | "VARIANT_NOT_FOUND"
  | "VARIANT_INACTIVE"
  | "DUPLICATE_ITEM"
  | "EMPTY_ORDER"
  | "INVALID_DISCOUNT"
  | "DISCOUNT_FORBIDDEN"
  | "PAYMENT_MISMATCH"
  | "INSUFFICIENT_STOCK"
  | "RETURN_UNSUPPORTED"
  | "INVALID_CLIENT_DATE"
  | "ORDER_FAILED";

export class SalesError extends ApiError {
  constructor(status: number, code: SalesErrorCode, message: string, details?: unknown) {
    super(status, message, { code, details });
    this.name = "SalesError";
  }
}
