"use client";

import { lazy, Suspense, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AuthCardFrame as AuthCard } from "@/components/application/auth/auth-card-frame";
import { Button } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { requestOtp, verifyOtp } from "@/lib/actions/auth";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/types";
import { cx } from "@/utils/cx";

const InputOtp = lazy(() => import("@/components/base/input-otp/input-otp").then((module) => ({ default: module.InputOtp })));

export function ParentLogin({ language, next, demo, tagline }: { language: Language; next: string; demo: boolean; tagline: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();
  const verifying = useRef(false);

  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function message(reason: string) {
    if (reason === "invalid") return t(language, step === "phone" ? "err.phoneInvalid" : "err.codeWrong");
    if (reason === "code_wrong") return t(language, "err.codeWrong");
    if (reason === "expired") return t(language, "err.codeExpired");
    if (reason === "too_many") return t(language, "err.tooMany", { minutes: 10 });
    if (reason === "cooldown") return t(language, "login.cooldown", { seconds: cooldown || 30 });
    return t(language, "common.loadFailed");
  }

  function send() {
    if (pending) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await requestOtp({ phone });
        if (!result.ok) { setError(result.code); return; }
        setPhone(result.phone); setCode(""); setStep("code"); setCooldown(30);
      } catch { setError("server"); }
    });
  }

  function verify(value: string) {
    if (verifying.current || value.length !== 6) return;
    verifying.current = true;
    setError("");
    startTransition(async () => {
      try {
        const result = await verifyOtp({ phone, code: value });
        if (!result.ok) { setError(result.code); setCode(""); return; }
        router.push(result.next === "/consent" ? `/consent?next=${encodeURIComponent(next)}` : next);
        router.refresh();
      } catch { setError("server"); }
      finally { verifying.current = false; }
    });
  }

  return (
    <AuthCard title={t(language, step === "phone" ? "login.title" : "login.codeTitle")} description={step === "phone" ? tagline : null} className="max-w-none gap-8 rounded-none border-0 bg-transparent p-0 shadow-none sm:p-0 [&_h1]:text-title-1-medium">
      <form noValidate onSubmit={(event) => { event.preventDefault(); if (step === "phone") send(); else verify(code); }} className="flex flex-col gap-6" aria-busy={pending}>
        {step === "phone" ? <label htmlFor="parent-phone" className="flex flex-col gap-2 text-headline-medium">{t(language, "login.phone")}<span className={cx("flex min-h-12 items-center gap-3 rounded-2lg border bg-background-primary-default px-3 shadow-xs focus-within:ring-2 focus-within:ring-border-focus-ring", error ? "border-border-error-default" : "border-border-button-default")}><span className="text-body-regular text-text-primary">+91</span><input id="parent-phone" type="tel" name="phone" inputMode="tel" autoComplete="tel-national" placeholder="90000 00587" value={phone} onChange={(event) => setPhone(event.target.value)} aria-invalid={!!error} aria-describedby={error ? "parent-login-error" : undefined} disabled={pending} className="min-w-0 flex-1 bg-transparent text-headline-regular text-text-primary outline-none placeholder:text-text-secondary" /></span></label> : <>
          <p className="text-body-regular text-text-secondary">{t(language, "login.codeSentTo", { phone })}</p>
          <Suspense fallback={<p role="status" className="text-body-regular">{t(language, "common.loading")}</p>}><InputOtp value={code} onChange={setCode} onComplete={verify} isDisabled={pending} isInvalid={!!error} aria-label={t(language, "login.codeTitle")} getDigitLabel={(n, total) => t(language, "login.digit", { n, total })} className="gap-1" /></Suspense>
          {demo ? <p className="text-body-regular text-text-secondary">{t(language, "login.demoCode", { code: "123456" })}</p> : null}
        </>}
        {error ? <p id="parent-login-error" role="alert" className="text-body-regular text-text-error-primary">{message(error)}</p> : null}
        <Button type="submit" disabled={pending || (step === "code" && code.length !== 6)} className="w-full text-headline-medium">{t(language, pending ? "common.loading" : step === "phone" ? "login.sendCode" : "login.continue")}</Button>
        {step === "code" ? <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <LinkButton disabled={pending || cooldown > 0} onClick={send}>{cooldown ? t(language, "login.cooldown", { seconds: cooldown }) : t(language, "login.resend")}</LinkButton>
            <LinkButton disabled={pending} variant="secondary" onClick={() => { setStep("phone"); setCode(""); setError(""); }}>{t(language, "login.changeNumber")}</LinkButton>
          </div>
          <p className="text-body-regular text-text-secondary">{t(language, "login.noCodeHelp")}</p>
        </> : <LinkButton href="/staff/login" variant="secondary" className="self-center">{t(language, "login.staff")}</LinkButton>}
      </form>
    </AuthCard>
  );
}
