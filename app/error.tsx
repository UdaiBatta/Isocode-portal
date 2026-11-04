"use client";

import { useLocale } from "react-aria-components";
import { ErrorState } from "@/components/app/ErrorState";
import { PageShell } from "@/components/app/PageShell";
import { languageFrom } from "@/lib/i18n";
import { retryRoute } from "@/lib/preview";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const { locale } = useLocale();
  return <PageShell><ErrorState onRetry={() => retryRoute(reset)} language={languageFrom(locale)} /></PageShell>;
}
