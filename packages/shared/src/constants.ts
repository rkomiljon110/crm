import type { RoleCode } from "./permissions";

export const ROLE_LABELS: Record<RoleCode, string> = {
  SUPER_ADMIN: "Super admin",
  BRANCH_MANAGER: "Filial boshqaruvchisi",
  SENIOR_SELLER: "Katta sotuvchi",
  CASHIER: "Kassir",
  WAREHOUSE: "Omborchi",
  ACCOUNTANT: "Buxgalter",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Qoralama",
  COMPLETED: "Yakunlangan",
  CANCELLED: "Bekor qilingan",
  REFUNDED: "Qaytarilgan",
};

export const ORDER_TYPE_LABELS: Record<string, string> = {
  SALE: "Sotuv",
  RETURN: "Qaytarish",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: "To'lanmagan",
  PARTIAL: "Qisman",
  PAID: "To'langan",
  REFUNDED: "Qaytarilgan",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Naqd",
  CARD: "Karta (Humo/Uzcard)",
  TRANSFER: "O'tkazma",
  CLICK: "Click",
  PAYME: "Payme",
  UZUM: "Uzum",
  OTHER: "Boshqa",
};

export const DEBT_TYPE_LABELS: Record<string, string> = {
  RECEIVABLE: "Bizga qarz",
  PAYABLE: "Bizning qarzimiz",
};

export const DEBT_STATUS_LABELS: Record<string, string> = {
  OPEN: "Ochiq",
  PARTIAL: "Qisman to'langan",
  PAID: "To'langan",
  OVERDUE: "Muddati o'tgan",
  WRITTEN_OFF: "Hisobdan chiqarilgan",
};

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  OPENING: "Boshlang'ich qoldiq",
  PURCHASE: "Kirim",
  SALE: "Sotuv",
  RETURN: "Qaytarish",
  LOSS: "Yo'qotish",
  ADJUSTMENT: "Tuzatish",
  TRANSFER_OUT: "Ko'chirish (chiqim)",
  TRANSFER_IN: "Ko'chirish (kirim)",
};

export const TRANSFER_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Qoralama",
  IN_TRANSIT: "Yo'lda",
  COMPLETED: "Yakunlangan",
  CANCELLED: "Bekor qilingan",
};

export const WAREHOUSE_TYPE_LABELS: Record<string, string> = {
  MAIN: "Markaziy ombor",
  SHOP: "Do'kon ombori",
  TRANSIT: "Tranzit ombor",
};

export const UNITS = [
  { name: "Dona", shortName: "dona", allowDecimal: false },
  { name: "Kilogramm", shortName: "kg", allowDecimal: true },
  { name: "Metr", shortName: "metr", allowDecimal: true },
  { name: "Litr", shortName: "litr", allowDecimal: true },
  { name: "Quti", shortName: "quti", allowDecimal: false },
  { name: "Paket", shortName: "paket", allowDecimal: false },
] as const;

export const EXPENSE_CATEGORIES = [
  { code: "RENT", name: "Ijara" },
  { code: "SALARY", name: "Oylik" },
  { code: "UTILITIES", name: "Kommunal" },
  { code: "TRANSPORT", name: "Transport" },
  { code: "TAX", name: "Soliq" },
  { code: "SUPPLIES", name: "Xarid / material" },
  { code: "FOOD", name: "Tushlik / xo'jalik" },
  { code: "OTHER", name: "Boshqa" },
] as const;

export const VAT_RATE = 0.12; // O'zbekistonda QQS 12%

export const CURRENCY = { primary: "UZS", secondary: "USD" } as const;
