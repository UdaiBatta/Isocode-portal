"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/application/auth/auth-card";
import { Input } from "@/components/base/input/input";
import { InputOtp } from "@/components/base/input-otp/input-otp";
import { Button } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { requestOtp, verifyOtp } from "@/lib/actions/auth";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/types";

export function ParentLogin({ language, next, demo }: { language: Language; next: string; demo: boolean }) {
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
    <AuthCard title={t(language, step === "phone" ? "login.title" : "login.codeTitle")} description={null} providers={[]} className="max-w-none rounded-none border-0 p-0 shadow-none sm:p-0 [&_h1]:text-title-1-medium">
      <form noValidate onSubmit={(event) => { event.preventDefault(); if (step === "phone") send(); else verify(code); }} className="flex flex-col gap-6" aria-busy={pending}>
        {step === "phone" ? <Input type="tel" name="phone" inputMode="tel" autoComplete="tel-national" label={<span className="text-headline-medium">{t(language, "login.phone")}</span>} placeholder="90000 00587" leadingAddon={<span className="text-text-primary">+91</span>} value={phone} onChange={setPhone} isInvalid={!!error} validationBehavior="aria" isDisabled={pending} fieldClassName="min-h-12" inputClassName="text-headline-regular placeholder:text-text-secondary" /> : <>
          <p className="text-body-regular text-text-secondary">{t(language, "login.codeSentTo", { phone })}</p>
          <InputOtp value={code} onChange={setCode} onComplete={verify} isDisabled={pending} isInvalid={!!error} aria-label={t(language, "login.codeTitle")} getDigitLabel={(n, total) => t(language, "login.digit", { n, total })} className="gap-1" />
          {demo ? <p className="text-body-regular text-text-secondary">{t(language, "login.demoCode", { code: "123456" })}</p> : null}
        </>}
        {error ? <p role="alert" className="text-body-regular text-text-error-primary">{message(error)}</p> : null}
        <Button type="submit" disabled={pending || (step === "code" && code.length !== 6)} className="w-full text-headline-medium">{t(language, pending ? "common.loading" : step === "phone" ? "login.sendCode" : "login.continue")}</Button>
        {step === "code" ? <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <LinkButton disabled={pending || cooldown > 0} onClick={send}>{cooldown ? t(language, "login.cooldown", { seconds: cooldown }) : t(language, "login.resend")}</LinkButton>
            <LinkButton disabled={pending} variant="secondary" onClick={() => { setStep("phone"); setCode(""); setError(""); }}>{t(language, "login.changeNumber")}</LinkButton>
          </div>
          <p className="text-body-regular text-text-secondary">{t(language, "login.noCodeHelp")}</p>
        </> : <LinkButton href="/staff/login" variant="secondary">{t(language, "login.staff")}</LinkButton>}
      </form>
    </AuthCard>
  );
}
