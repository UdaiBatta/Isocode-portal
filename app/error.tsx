"use client";

import { useLocale } from "react-aria-components";
import { ErrorState } from "@/components/app/ErrorState";
import { PageShell } from "@/components/app/PageShell";
import { languageFrom } from "@/lib/i18n";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const { locale } = useLocale();
  return <PageShell><ErrorState onRetry={reset} language={languageFrom(locale)} /></PageShell>;
}
