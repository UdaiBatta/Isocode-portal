"use client";

import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiBankCardLine, RiBankLine, RiSmartphoneLine } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/buttons/button-group";
import { Radio, RadioGroup } from "@/components/base/radio/radio";
import { Spinner } from "@/components/base/spinner/spinner";
import { submitMockPayment } from "@/lib/actions/payments";
import { inr } from "@/lib/format";
import { t } from "@/lib/i18n";
import { ct } from "@/lib/i18n/checkout";
import type { Language } from "@/lib/types";

const methods = [
  { id: "upi", icon: RiSmartphoneLine, label: "receipt.method.upi", hint: "checkout.upiHint", step: "checkout.step.upi" },
  { id: "card", icon: RiBankCardLine, label: "checkout.card", hint: "checkout.cardHint", step: "checkout.step.card" },
  { id: "netbanking", icon: RiBankLine, label: "receipt.method.netbanking", hint: "checkout.netbankingHint", step: "checkout.step.netbanking" },
] as const;
type Method = (typeof methods)[number]["id"];

// Long enough for the three steps to read. A real gateway takes longer than the local demo call.
const PROCESSING_MS = 2100;
const STEP_MS = 700;
const noSubscription = () => () => {};

export function MockGateway({ token, language, amount }: { token: string; language: Language; amount: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const [method, setMethod] = useState<Method>("upi");
  const inFlight = useRef(false);
  // False in the server HTML. A tap before the page is interactive would otherwise be lost, which slow phones make likely.
  const ready = useSyncExternalStore(noSubscription, () => true, () => false);
  function pay(outcome: "success" | "failed" | "wrong_amount") {
    if (inFlight.current) return;
    inFlight.current = true;
    setFailed(false);
    startTransition(async () => {
      try {
        const [result] = await Promise.all([submitMockPayment({ token, outcome, method }), new Promise((done) => setTimeout(done, PROCESSING_MS))]);
        if (!result.ok) { setFailed(true); return; }
        router.push(`/pay/${token}/result?e=${encodeURIComponent(result.eventId)}`);
        router.refresh();
      } catch { setFailed(true); }
      finally { inFlight.current = false; }
    });
  }
  if (pending) {
    const steps = [methods.find((item) => item.id === method)!.step, "checkout.step.confirm", "checkout.step.record"] as const;
    return <div role="status" className="flex flex-col gap-5 rounded-3xl border border-border-button-default p-5">
      <div className="flex items-center gap-3"><Spinner size="sm" aria-hidden /><p className="text-headline-medium">{t(language, "pay.confirming")}</p></div>
      <ol className="flex flex-col gap-3">{steps.map((step, index) => <li key={step} className="pay-step flex items-center gap-3 text-body-regular" style={{ animationDelay: `${index * STEP_MS}ms` }}>
        <svg className="shrink-0 text-accent-600" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {ct(language, step)}
      </li>)}</ol>
      <p className="text-body-2-regular text-text-secondary">{ct(language, "checkout.keepOpen")}</p>
    </div>;
  }
  return <div className="flex flex-col gap-6">
    <RadioGroup aria-label={ct(language, "checkout.payWith")} value={method} onChange={(value) => setMethod(value as Method)} className="gap-3">
      <p className="text-headline-medium" aria-hidden="true">{ct(language, "checkout.payWith")}</p>
      {methods.map(({ id, icon: Icon, label, hint }) => <Radio key={id} value={id} className="w-full rounded-xl border border-border-button-default p-4 data-selected:border-accent-500 data-selected:bg-accent-50">
        <span className="flex items-center gap-3"><Icon size={20} aria-hidden="true" className="shrink-0 text-foreground-icon-secondary" /><span className="flex flex-col"><span className="text-body-medium">{ct(language, label)}</span><span className="text-body-2-regular text-text-secondary">{ct(language, hint)}</span></span></span>
      </Radio>)}
    </RadioGroup>
    <div className="flex flex-col gap-3">
      <Button disabled={!ready} onClick={() => pay("success")} className="w-full text-headline-medium">{t(language, "pay.button", { amount: inr(amount) })}</Button>
      <p className="text-body-2-regular text-text-secondary">{ct(language, "checkout.receiptNote")}</p>
    </div>
    <div className="flex flex-col gap-2">
      <p className="text-body-2-regular text-text-secondary">{t(language, "pay.outcomes")}</p>
      <ButtonGroup aria-label={t(language, "pay.outcomes")} className="w-full">
        <ButtonGroupItem disabled={!ready} onClick={() => pay("failed")} className="flex-1">{t(language, "pay.failAction")}</ButtonGroupItem>
        <ButtonGroupItem disabled={!ready} onClick={() => pay("wrong_amount")} className="flex-1">{t(language, "pay.wrongAction")}</ButtonGroupItem>
      </ButtonGroup>
    </div>
    {failed ? <p role="alert" className="text-body-regular text-text-error-primary">{t(language, "common.loadFailed")}</p> : null}
  </div>;
}
