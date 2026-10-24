import { z } from "zod";
import { orderSchema } from "./validators";

/**
 * Offline-First sync shartnomasi (Web/PWA, Tauri va mobil kassa uchun umumiy).
 *
 * Har bir offline chek `clientOrderId` (UUID) bilan yuboriladi. Server
 * `Order.tenantId + offlineId` unikal kaliti va advisory lock orqali takroriy
 * yuborishni idempotent qabul qiladi: birinchi so'rov order yaratadi,
 * keyingilari `skipped_duplicate` statusida mavjud orderni qaytaradi.
 */

export const syncOrderSchema = orderSchema.extend({
  /** Klientda generatsiya qilingan UUID — idempotentlik kaliti */
  clientOrderId: z.string().uuid("clientOrderId UUID bo'lishi kerak"),
  /** Mahalliy kassada chek urilgan vaqt (timezone offset bilan) */
  clientCreatedAt: z.string().datetime({ offset: true }),
});

export const syncBatchSchema = z.object({
  deviceId: z.string().trim().min(1).max(100),
  orders: z.array(syncOrderSchema).min(1, "Batch bo'sh").max(100, "Bir batchda ko'pi bilan 100 chek"),
});

export type OfflineOrder = z.infer<typeof syncOrderSchema>;
export type SyncBatch = z.infer<typeof syncBatchSchema>;

export type SyncOrderStatus = "processed" | "skipped_duplicate" | "failed";

export interface SyncOrderResult {
  clientOrderId: string;
  status: SyncOrderStatus;
  orderId?: string;
  orderNumber?: string;
  totalAmount?: number;
  /** Mashina o'qiydigan xato kodi: INSUFFICIENT_STOCK, SHIFT_REQUIRED, ... */
  code?: string;
  error?: string;
}

export interface SyncBatchSummary {
  total: number;
  processed: number;
  skippedDuplicate: number;
  failed: number;
}

export interface SyncBatchResult {
  deviceId: string;
  serverTime: string;
  summary: SyncBatchSummary;
  results: SyncOrderResult[];
}

/** Mahalliy navbatdagi yozuv holati (IndexedDB/WatermelonDB uchun) */
export type LocalSyncStatus = "pending" | "syncing" | "synced" | "failed";
