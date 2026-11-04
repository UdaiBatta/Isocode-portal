"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiErrorWarningLine, RiEyeLine, RiEyeOffLine } from "@remixicon/react";
import { AuthCardFrame as AuthCard } from "@/components/application/auth/auth-card-frame";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/buttons/button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { Spinner } from "@/components/base/spinner/spinner";
import { staffLogin } from "@/lib/actions/auth";

export function StaffSignIn() {
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const router = useRouter();
  return <AuthCard title="Staff sign-in" description="Dues, reminders and refunds across all four centres." className="max-w-none gap-8 rounded-none border-0 bg-transparent p-0 shadow-none sm:p-0 [&_h1]:text-title-1-medium">
    <form className="flex flex-col gap-5" onSubmit={(event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      startTransition(async () => { try { const result = await staffLogin({ email: data.get("email"), password: data.get("password") }); setFailure(result.ok ? "" : ["credentials", "too_many", "role_unavailable"].includes(result.code) ? result.message : "Sign-in could not be completed. Try again."); if (result.ok) { router.push(result.next); router.refresh(); } } catch { setFailure("Sign-in could not be completed. Try again."); } });
    }}>
      {failure ? <p role="alert" className="flex gap-2.5 rounded-xl bg-status-rose-background px-3.5 py-3 text-body-regular text-status-rose-text"><RiErrorWarningLine size={18} aria-hidden="true" className="mt-0.5 shrink-0" />{failure}</p> : null}
      <Input label="Email" name="email" type="email" autoComplete="username" placeholder="accounts@demo.test" isRequired isDisabled={pending} fieldClassName="min-h-11" />
      <div className="flex flex-col gap-2" onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}>
        <div className="relative">
          <Input label="Password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" isRequired isDisabled={pending} fieldClassName="min-h-11 pe-11" />
          <IconButton icon={showPassword ? RiEyeOffLine : RiEyeLine} size="small" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((shown) => !shown)} className="absolute end-0 bottom-0 w-11 border-0 bg-transparent" />
        </div>
        {capsLock ? <p className="text-body-2-regular text-status-yellow-text">Caps Lock is on</p> : null}
      </div>
      <Button type="submit" disabled={pending} className="w-full">{pending ? <><Spinner size="sm" aria-hidden /> Signing in…</> : "Sign in"}</Button>
      <LinkButton href="/login" variant="secondary" className="self-center">Parent sign-in</LinkButton>
    </form>
  </AuthCard>;
}
