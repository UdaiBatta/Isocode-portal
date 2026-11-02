"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LinkButton } from "@/components/base/buttons/link-button";
import { logout } from "@/lib/actions/auth";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/types";

export function LogoutButton({ language }: { language: Language }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  return <>
    <LinkButton variant="secondary" disabled={pending} onClick={() => startTransition(async () => {
      try { const result = await logout(); if (result.ok) { router.push(result.next); router.refresh(); } else setError(true); }
      catch { setError(true); }
    })}>{t(language, "common.logout")}</LinkButton>
    {error ? <p role="alert" className="text-body-regular text-text-error-primary">{t(language, "common.loadFailed")}</p> : null}
  </>;
}
