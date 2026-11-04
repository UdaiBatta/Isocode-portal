import { fill } from "@/lib/i18n";
import type { Language } from "@/lib/types";

// Rendered on the server only, so parent pages do not ship it: /dues has a 200 KB script budget.
const en = {
  "before": "{student}'s fee instalment of {amount} is due on {date}. Pay here: {link}",
  "today": "{student}'s fee instalment of {amount} is due today. Pay here: {link}",
  "after": "{student}'s fee instalment of {amount} was due on {date}. Pay here: {link}. If you have already paid, please ignore this.",
};

const hi = {
  "before": "{student} की फीस की किस्त {amount}, {date} तक जमा करनी है। यहाँ भुगतान करें: {link}",
  "today": "{student} की फीस की किस्त {amount} आज जमा करनी है। यहाँ भुगतान करें: {link}",
  "after": "{student} की फीस की किस्त {amount} की अंतिम तिथि {date} थी। यहाँ भुगतान करें: {link}। अगर आप भुगतान कर चुके हैं, तो कृपया इसे अनदेखा करें।",
} satisfies Record<keyof typeof en, string>;

export function renderReminder(language: Language, step: number, values: Record<string, string | number>): string {
  const key = step < 0 ? "before" : step > 0 ? "after" : "today";
  return fill((language === "hi" ? hi : en)[key], values);
}
