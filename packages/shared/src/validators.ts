import { z } from "zod";

/** Telefon raqamni +998XXXXXXXXX ko'rinishiga keltiradi */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 9) return `+998${digits}`;
  if (digits.length === 12 && digits.startsWith("998")) return `+${digits}`;
  return input.trim();
}

export const phoneSchema = z
  .string()
  .trim()
  .min(9, "Telefon raqam kiriting")
  .transform(normalizePhone)
  .refine((v) => /^\+998\d{9}$/.test(v), "Telefon formati: +998 XX XXX XX XX");

export const optionalPhoneSchema = z
  .string()
  .trim()
  .transform((v) => (v ? normalizePhone(v) : ""))
  .refine((v) => v === "" || /^\+998\d{9}$/.test(v), "Telefon formati: +998 XX XXX XX XX")
  .optional();

export const tenantSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{1,39}$/, "Biznes kodi faqat kichik lotin harflari, raqam va '-' dan iborat");

export const loginSchema = z.object({
  tenantSlug: tenantSlugSchema,
  phone: phoneSchema,
  password: z.string().min(4, "Parol kamida 4 belgi"),
});

export const passwordSchema = z.string().min(8, "Parol kamida 8 belgi bo'lsin");

const money = z.coerce.number().finite().min(0, "Summa manfiy bo'lmasin");
const positiveMoney = z.coerce.number().finite().positive("Summa 0 dan katta bo'lsin");
const qty = z.coerce.number().finite().positive("Miqdor 0 dan katta bo'lsin");
const isoDate = z.string().datetime({ offset: true });

export const PAYMENT_METHOD_VALUES = ["CASH", "CARD", "TRANSFER", "CLICK", "PAYME", "UZUM", "OTHER"] as const;
export const paymentMethodSchema = z.enum(PAYMENT_METHOD_VALUES);

/**
 * POS to'lovi "DEBT" ni ham qabul qiladi: bu haqiqiy pul harakati emas,
 * chekning nasiya qismi. Server DEBT uchun PaymentTransaction yaratmaydi,
 * buning o'rniga DebtRecord va mijoz balansini yozadi.
 */
export const POS_PAYMENT_METHOD_VALUES = [...PAYMENT_METHOD_VALUES, "DEBT"] as const;
export const posPaymentMethodSchema = z.enum(POS_PAYMENT_METHOD_VALUES);
export type PosPaymentMethod = (typeof POS_PAYMENT_METHOD_VALUES)[number];

// ─────────────────────────── KATALOG ───────────────────────────

export const variantSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Variant nomi kerak").max(80),
  sku: z.string().trim().max(64).optional().nullable(),
  attributes: z.record(z.union([z.string(), z.number()])).optional().nullable(),
  costPrice: money,
  sellingPrice: money,
  wholesalePrice: money.optional().nullable(),
  barcode: z.string().trim().max(64).optional().nullable(),
  isDefault: z.boolean().default(false),
});

export const productSchema = z.object({
  name: z.string().trim().min(1, "Tovar nomi kerak").max(160),
  categoryId: z.string().min(1, "Kategoriya tanlang"),
  unitId: z.string().min(1, "O'lchov birligi tanlang"),
  sku: z.string().trim().max(64).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  hasVariants: z.boolean().default(false),
  minStockAlert: z.coerce.number().finite().min(0).default(5),
  isActive: z.boolean().default(true),
  variants: z.array(variantSchema).min(1, "Kamida bitta variant kerak"),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Kategoriya nomi kerak").max(80),
  parentId: z.string().optional().nullable(),
});

export const unitSchema = z.object({
  name: z.string().trim().min(1).max(40),
  shortName: z.string().trim().min(1).max(12),
  allowDecimal: z.boolean().default(false),
});

// ─────────────────────────── SAVDO / POS ───────────────────────────

export const orderItemSchema = z.object({
  variantId: z.string().min(1, "Tovar tanlanmagan"),
  quantity: qty.max(100_000, "Miqdor juda katta"),
  unitPrice: money,
  discountAmount: money.default(0),
});

export const orderPaymentSchema = z.object({
  method: posPaymentMethodSchema,
  amount: positiveMoney,
  provider: z.string().max(40).optional().nullable(),
  providerRef: z.string().max(120).optional().nullable(),
});

export const orderSchema = z.object({
  type: z.enum(["SALE", "RETURN"]).default("SALE"),
  storeId: z.string().optional().nullable(),
  warehouseId: z.string().min(1, "Ombor tanlang"),
  customerId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  items: z.array(orderItemSchema).min(1, "Savat bo'sh"),
  discountAmount: money.default(0),
  taxAmount: money.default(0),
  dueDate: isoDate.optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  offlineId: z.string().min(8).max(100).optional().nullable(),
  clientCreatedAt: isoDate.optional().nullable(),
  payments: z.array(orderPaymentSchema).default([]),
});

export const returnSchema = z.object({
  orderId: z.string().min(1),
  items: z
    .array(
      z.object({
        orderItemId: z.string().min(1),
        quantity: qty,
      }),
    )
    .min(1),
  reason: z.string().max(300).optional(),
  refundMethod: paymentMethodSchema.default("CASH"),
});

// ─────────────────────────── OMBOR ───────────────────────────

export const purchaseSchema = z.object({
  warehouseId: z.string().min(1),
  supplierId: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: qty,
        unitCost: positiveMoney,
      }),
    )
    .min(1, "Kamida bitta tovar kiriting"),
  paidAmount: money.default(0),
  note: z.string().max(300).optional(),
});

export const adjustmentSchema = z.object({
  warehouseId: z.string().min(1),
  variantId: z.string().min(1),
  changeType: z.enum(["LOSS", "ADJUSTMENT", "RETURN"]),
  quantity: positiveMoney,
  reason: z.string().max(300).optional(),
});

export const auditSchema = z.object({
  warehouseId: z.string().min(1),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        countedQty: z.coerce.number().finite().min(0),
      }),
    )
    .min(1),
  note: z.string().max(300).optional(),
});

export const transferSchema = z.object({
  fromWarehouseId: z.string().min(1),
  toWarehouseId: z.string().min(1),
  items: z.array(z.object({ variantId: z.string().min(1), quantity: qty })).min(1),
  note: z.string().max(300).optional(),
});

// ─────────────────────────── MIJOZ / QARZ ───────────────────────────

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Mijoz ismi kerak").max(160),
  phone: optionalPhoneSchema,
  passport: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(250).optional().nullable(),
  maxDebtLimit: money.default(0),
  note: z.string().max(500).optional().nullable(),
  telegramChatId: z.string().trim().max(60).optional().nullable(),
});

export const customerUpdateSchema = customerSchema.partial().extend({
  isBlocked: z.boolean().optional(),
});

export const debtPaymentSchema = z.object({
  debtRecordId: z.string().min(1),
  amount: positiveMoney,
  method: paymentMethodSchema.default("CASH"),
  note: z.string().max(300).optional(),
});

export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Nom kerak").max(160),
  phone: optionalPhoneSchema,
  address: z.string().trim().max(250).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

export const supplierPaymentSchema = z.object({
  supplierId: z.string().min(1),
  amount: positiveMoney,
  method: paymentMethodSchema.default("CASH"),
  description: z.string().max(300).optional(),
});

// ─────────────────────────── MOLIYA ───────────────────────────

export const expenseSchema = z.object({
  categoryId: z.string().min(1, "Xarajat turi tanlang"),
  storeId: z.string().optional().nullable(),
  amount: positiveMoney,
  description: z.string().max(300).optional().nullable(),
  date: isoDate.optional(),
});

export const shiftOpenSchema = z.object({
  storeId: z.string().min(1),
  openingCash: money,
  note: z.string().max(300).optional(),
});

export const shiftCloseSchema = z.object({
  shiftId: z.string().min(1),
  closingCash: money,
  note: z.string().max(300).optional(),
});

// ─────────────────────────── XODIM / SOZLAMA ───────────────────────────

export const staffCreateSchema = z.object({
  name: z.string().trim().min(1, "Ism kerak").max(120),
  phone: phoneSchema,
  password: passwordSchema,
  roleId: z.string().min(1, "Rol tanlang"),
  storeId: z.string().optional().nullable(),
});

export const staffUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  roleId: z.string().min(1).optional(),
  storeId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  password: passwordSchema.optional(),
});

export const settingsSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  address: z.string().max(250).optional().nullable(),
  phone: optionalPhoneSchema,
  usdRate: z.coerce.number().finite().positive().optional(),
  receiptFooter: z.string().max(300).optional().nullable(),
});

// ─────────────────────────── UMUMIY ───────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(100).optional(),
});

export const dateRangeSchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type PurchaseInput = z.infer<typeof purchaseSchema>;
export type DebtPaymentInput = z.infer<typeof debtPaymentSchema>;
