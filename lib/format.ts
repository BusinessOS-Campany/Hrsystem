export type AppLocale = "en" | "ar";

export function intlLocale(locale: string) {
  return locale === "ar" ? "ar-YE-u-ca-gregory-nu-latn" : "en-GB";
}

export function formatDate(
  value: Date | string | null | undefined,
  locale: string,
  options: Intl.DateTimeFormatOptions = {},
) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
    ...options,
  }).format(date);
}

export function formatDateTime(
  value: Date | string | null | undefined,
  locale: string,
) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Aden",
  }).format(date);
}

export function formatMonth(month: number, locale: string, year?: number) {
  const date = new Date(Date.UTC(year ?? 2026, month - 1, 1));
  return new Intl.DateTimeFormat(intlLocale(locale), {
    month: "long",
    year: year ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(date);
}

type Numeric = number | string | { toString(): string } | null | undefined;

export function formatMoney(
  value: Numeric,
  locale: string,
  currency = "YER",
) {
  const amount = value === null || value === undefined ? value : Number(value);
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(value: Numeric, locale: string) {
  if (value === null || value === undefined) return "—";
  const amount = Number(value);
  if (Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat(intlLocale(locale)).format(amount);
}

export function formatPercent(value: number | null | undefined, locale: string) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function localizedName(
  locale: string,
  name: string | null | undefined,
  nameAr: string | null | undefined,
) {
  return locale === "ar" && nameAr ? nameAr : (name ?? "—");
}

export function startOfMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function utcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function daysBetween(start: Date, end: Date) {
  return Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1,
  );
}
