/**
 * Savdo hisob-kitobi — mijoz (POS) va server bir xil formuladan foydalanadi.
 *
 * Barcha hisob-kitob **tiyin** (1/100 UZS) butun sonlarida bajariladi, shuning
 * uchun 0.1 + 0.2 turdagi float xatolari chek summasiga ta'sir qilmaydi.
 * Miqdor 3 xonagacha (kg/metr) bo'lishi mumkin.
 */

export const MINOR_UNITS_PER_UNIT = 100;
export const QTY_SCALE = 1000;

export interface SaleLineInput {
  quantity: number;
  unitPrice: number;
  discountAmount?: number | null;
}

export interface SaleTotals {
  /** Har bir qator uchun chegirmadan keyingi summa (so'm) */
  lineTotals: number[];
  /** Qatorlar yig'indisi, chegirmadan oldin (so'm) */
  subtotal: number;
  /** Chek darajasidagi chegirma (so'm) */
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
}

function toMinor(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * MINOR_UNITS_PER_UNIT) : 0;
}

function toQtyMilli(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * QTY_SCALE) : 0;
}

function fromMinor(value: number): number {
  return value / MINOR_UNITS_PER_UNIT;
}

/**
 * Qator summasi = round(qty * unitPrice, 2) - qator chegirmasi.
 * Chegirma qator summasidan katta bo'lishi mumkin emas (0 ga qisqartiriladi).
 */
export function calculateSaleTotals(
  items: SaleLineInput[],
  discountAmount = 0,
  taxAmount = 0,
): SaleTotals {
  let subtotalMinor = 0;
  const lineTotalsMinor: number[] = [];

  for (const item of items) {
    const grossMinor = Math.round((toQtyMilli(item.quantity) * toMinor(item.unitPrice)) / QTY_SCALE);
    const lineDiscountMinor = Math.max(0, toMinor(item.discountAmount));
    const netMinor = Math.max(0, grossMinor - lineDiscountMinor);
    lineTotalsMinor.push(netMinor);
    subtotalMinor += netMinor;
  }

  const orderDiscountMinor = Math.min(Math.max(0, toMinor(discountAmount)), subtotalMinor);
  const taxMinor = Math.max(0, toMinor(taxAmount));
  const totalMinor = subtotalMinor - orderDiscountMinor + taxMinor;

  return {
    lineTotals: lineTotalsMinor.map(fromMinor),
    subtotal: fromMinor(subtotalMinor),
    discountAmount: fromMinor(orderDiscountMinor),
    taxAmount: fromMinor(taxMinor),
    totalAmount: fromMinor(totalMinor),
  };
}

/** Ikki pul summasini tiyin aniqligida tenglashtiradi */
export function moneyEquals(a: unknown, b: unknown): boolean {
  return toMinor(a) === toMinor(b);
}

/** Summani tiyin butun soniga o'giradi (DB/validatsiya uchun) */
export function moneyToMinor(value: unknown): number {
  return toMinor(value);
}
