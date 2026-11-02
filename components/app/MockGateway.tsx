"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/buttons/button-group";
import { Spinner } from "@/components/base/spinner/spinner";
import { submitMockPayment } from "@/lib/actions/payments";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/types";

export function MockGateway({ token, language }: { token: string; language: Language }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  function pay(outcome: "success" | "failed" | "wrong_amount") {
    if (inFlight.current) return;
    inFlight.current = true;
    setFailed(false);
    startTransition(async () => {
      try {
        const result = await submitMockPayment({ token, outcome });
        if (!result.ok) { setFailed(true); return; }
        router.push(`/pay/${token}/result?e=${encodeURIComponent(result.eventId)}`);
        router.refresh();
      } catch { setFailed(true); }
      finally { inFlight.current = false; }
    });
  }
  return <div className="flex flex-col gap-6" aria-busy={pending}>
    {pending ? <div className="flex items-center gap-3" role="status"><Spinner size="sm" aria-label={t(language, "pay.confirming")} /><span className="text-body-regular">{t(language, "pay.confirming")}</span></div> : null}
    <ButtonGroup aria-label={t(language, "pay.outcomes")} className="w-full flex-col divide-x-0 divide-y divide-border-button-default">
      <ButtonGroupItem disabled={pending} onClick={() => pay("success")} className="text-headline-medium">{t(language, "pay.successAction")}</ButtonGroupItem>
      <ButtonGroupItem disabled={pending} onClick={() => pay("failed")} className="text-headline-medium">{t(language, "pay.failAction")}</ButtonGroupItem>
      <ButtonGroupItem disabled={pending} onClick={() => pay("wrong_amount")} className="text-headline-medium">{t(language, "pay.wrongAction")}</ButtonGroupItem>
    </ButtonGroup>
    {failed ? <p role="alert" className="text-body-regular text-text-error-primary">{t(language, "common.loadFailed")}</p> : null}
  </div>;
}
