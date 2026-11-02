import { en } from "./en";
import { hi } from "./hi";
import type { Language } from "@/lib/types";

export type TranslationKey = keyof typeof en;

export function languageFrom(value: unknown): Language {
  return value === "en" ? "en" : "hi";
}

export function t(language: Language, key: TranslationKey, values: Record<string, string | number> = {}): string {
  return (language === "hi" ? hi[key] : en[key]).replace(/\{(\w+)\}/g, (_, name: string) => {
    if (values[name] === undefined) throw new Error(`Missing translation value: ${name}`);
    return String(values[name]);
  });
}
