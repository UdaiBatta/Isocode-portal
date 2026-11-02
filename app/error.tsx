"use client";

import { useLocale } from "react-aria-components";
import { ErrorState } from "@/components/app/ErrorState";
import { PageShell } from "@/components/app/PageShell";
import { languageFrom } from "@/lib/i18n";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const { locale } = useLocale();
  return <PageShell><ErrorState onRetry={() => {
    const url = new URL(window.location.href);
    if (process.env.NEXT_PUBLIC_PROTO === "1" && url.searchParams.get("state") === "error") {
      url.searchParams.delete("state");
      window.location.assign(url.pathname + url.search + url.hash);
    } else reset();
  }} language={languageFrom(locale)} /></PageShell>;
}
