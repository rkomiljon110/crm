/**
 * O'zbekiston vaqti (UTC+5, yozgi vaqt yo'q).
 * Barcha kunlik hisobotlar mahalliy kun chegaralari bo'yicha hisoblanadi.
 */
export const UZ_OFFSET_MINUTES = 5 * 60;
export const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfUzDay(date: Date = new Date()): Date {
  const shifted = new Date(date.getTime() + UZ_OFFSET_MINUTES * 60 * 1000);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
      UZ_OFFSET_MINUTES * 60 * 1000,
  );
}

export function endOfUzDay(date: Date = new Date()): Date {
  return new Date(startOfUzDay(date).getTime() + DAY_MS);
}

export function startOfUzMonth(date: Date = new Date()): Date {
  const shifted = new Date(date.getTime() + UZ_OFFSET_MINUTES * 60 * 1000);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - UZ_OFFSET_MINUTES * 60 * 1000,
  );
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function toUzDateKey(date: Date): string {
  const shifted = new Date(date.getTime() + UZ_OFFSET_MINUTES * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function isOverdue(dueDate: string | Date | null | undefined): boolean {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}

export function daysOverdue(dueDate: string | Date): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / DAY_MS));
}

export function toDateInputValue(date: string | Date | null | undefined): string {
  if (!date) return "";
  return toUzDateKey(typeof date === "string" ? new Date(date) : date);
}
