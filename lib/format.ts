import type { Language } from "@/lib/types";

export const inr = (p: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR",
    minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2,
  }).format(p / 100);

export function dateLabel(date: string, language: Language, referenceDate: string): string {
  return new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: language === "hi" ? "long" : "short",
    year: date.slice(0, 4) === referenceDate.slice(0, 4) ? undefined : "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
