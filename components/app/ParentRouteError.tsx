"use client";

import { useLocale } from "react-aria-components";
import { ErrorState } from "./ErrorState";
import { PageShell } from "./PageShell";
import { LinkButton } from "@/components/base/buttons/link-button";
import { languageFrom, t } from "@/lib/i18n";
import { retryRoute } from "@/lib/preview";

// A client error boundary cannot read the family on the server, so it offers a way back instead of the full navigation.
export function ParentRouteError({ reset }: { reset: () => void }) {
  const language = languageFrom(useLocale().locale);
  return <PageShell><ErrorState language={language} onRetry={() => retryRoute(reset)} /><LinkButton href="/dues" variant="secondary">{t(language, "pay.backToDues")}</LinkButton></PageShell>;
}
