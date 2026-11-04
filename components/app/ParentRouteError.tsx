"use client";

import { useLocale } from "react-aria-components";
import { ErrorState } from "./ErrorState";
import { PageShell } from "./PageShell";
import { LinkButton } from "@/components/base/buttons/link-button";
import { languageFrom, t } from "@/lib/i18n";

// A client error boundary cannot read the family on the server, so it offers a way back instead of the full navigation.
export function ParentRouteError({ reset }: { reset: () => void }) {
  const language = languageFrom(useLocale().locale);
  return <PageShell><ErrorState language={language} onRetry={() => {
    const url = new URL(window.location.href);
    if (process.env.NEXT_PUBLIC_PROTO === "1" && url.searchParams.get("state") === "error") {
      url.searchParams.delete("state");
      window.location.assign(url.pathname + url.search + url.hash);
    } else reset();
  }} /><LinkButton href="/dues" variant="secondary">{t(language, "pay.backToDues")}</LinkButton></PageShell>;
}
