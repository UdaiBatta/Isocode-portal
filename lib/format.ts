import type { Language } from "@/lib/types";

export const inr = (p: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR",
    minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2,
  }).format(p / 100);

export function rupeesToPaise(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error("Enter a positive amount with at most two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const amount = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (amount <= BigInt(0) || amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Enter a valid payment amount.");
  return Number(amount);
}

export const phoneLabel = (phone: string) => phone.replace(/^\+91(\d{5})(\d{5})$/, "+91 $1 $2");

export function dateLabel(date: string, language: Language, referenceDate: string): string {
  return new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: language === "hi" ? "long" : "short",
    year: date.slice(0, 4) === referenceDate.slice(0, 4) ? undefined : "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
