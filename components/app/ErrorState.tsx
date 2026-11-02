"use client";

import { Button } from "@/components/base/buttons/button";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/types";

export function ErrorState({ onRetry, language }: { onRetry: () => void; language: Language }) {
  return (
    <section className="flex flex-col gap-6 py-12" role="alert">
      <p className="text-headline-regular text-text-secondary">{t(language, "common.loadFailed")}</p>
      <Button onClick={onRetry} className="h-12 text-headline-medium">{t(language, "common.retry")}</Button>
    </section>
  );
}
