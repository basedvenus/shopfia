import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(amount / 100);
}

export function parseCurrencyToCents(value: string) {
  const normalized = value.replace(/[^0-9.]/g, "");
  const num = Number(normalized);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 1
  }).format(value);
}

export function centsToDollars(amountCents: number) {
  return amountCents / 100;
}

export function basisPointsToPercent(basisPoints: number) {
  return basisPoints / 100;
}
