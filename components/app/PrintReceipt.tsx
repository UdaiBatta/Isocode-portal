"use client";

import { Button } from "@/components/base/buttons/button";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/types";

export function PrintReceipt({ language }: { language: Language }) {
  return <Button onClick={() => window.print()} className="w-full text-headline-medium print:hidden">{t(language, "receipt.print")}</Button>;
}
