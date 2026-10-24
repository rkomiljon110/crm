import { VAT_RATE } from "./constants";

const uzsFormatter = new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 });
const qtyFormatter = new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 3 });

export function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function roundUzs(value: number): number {
  return Math.round(toNumber(value));
}

/** 1 250 000 so'm */
export function formatUZS(value: unknown): string {
  return `${uzsFormatter.format(roundUzs(toNumber(value)))} so'm`;
}

/** 1 250 000 (valyuta belgisisiz) */
export function formatNumber(value: unknown): string {
  return uzsFormatter.format(roundUzs(toNumber(value)));
}

/** 1 250 000,50 (tiyin bilan) */
export function formatMoney(value: unknown): string {
  return new Intl.NumberFormat("uz-UZ", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
    toNumber(value),
  );
}

export function formatQty(value: unknown, unit?: string): string {
  const formatted = qtyFormatter.format(toNumber(value));
  return unit ? `${formatted} ${unit}` : formatted;
}

export function toUsd(uzs: unknown, usdRate: number): number {
  if (!usdRate || usdRate <= 0) return 0;
  return Math.round((toNumber(uzs) / usdRate) * 100) / 100;
}

export function toUzs(usd: unknown, usdRate: number): number {
  return roundUzs(toNumber(usd) * usdRate);
}

export function formatUsd(uzs: unknown, usdRate: number): string {
  if (!usdRate || usdRate <= 0) return "";
  return `≈ $${toUsd(uzs, usdRate).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/** Foyda foizi: (sotish - tannarx) / sotish * 100 */
export function marginPercent(sellingPrice: unknown, costPrice: unknown): number {
  const sell = toNumber(sellingPrice);
  if (sell <= 0) return 0;
  return Math.round(((sell - toNumber(costPrice)) / sell) * 10000) / 100;
}

/** Ustama foizi: (sotish - tannarx) / tannarx * 100 */
export function markupPercent(sellingPrice: unknown, costPrice: unknown): number {
  const cost = toNumber(costPrice);
  if (cost <= 0) return 0;
  return Math.round(((toNumber(sellingPrice) - cost) / cost) * 10000) / 100;
}

/** QQSni narxdan ajratib olish (narx QQSni o'z ichiga oladi) */
export function extractVat(grossAmount: unknown, rate = VAT_RATE): { net: number; vat: number } {
  const gross = toNumber(grossAmount);
  const net = roundUzs(gross / (1 + rate));
  return { net, vat: roundUzs(gross - net) };
}

export function calculateVat(netAmount: unknown, rate = VAT_RATE): number {
  return roundUzs(toNumber(netAmount) * rate);
}

/** Chegirma summasini yakuniy summaga qo'llash */
export function applyDiscount(subtotal: unknown, discount: unknown): number {
  const s = toNumber(subtotal);
  const d = Math.min(Math.max(toNumber(discount), 0), s);
  return roundUzs(s - d);
}

export function splitPayment(total: unknown, amounts: number[]): { paid: number; remaining: number } {
  const paid = roundUzs(amounts.reduce((acc, a) => acc + Math.max(0, toNumber(a)), 0));
  return { paid, remaining: Math.max(0, roundUzs(toNumber(total) - paid)) };
}
