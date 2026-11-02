"use client";

import { useState, useTransition } from "react";
import { AuthCard } from "@/components/application/auth/auth-card";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { LogoutButton } from "./LogoutButton";
import { staffLogin } from "@/lib/actions/auth";

export function StaffSignIn() {
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  if (signedIn) return <div className="flex flex-col gap-6"><h1 className="text-title-1-medium">You are signed in</h1><LogoutButton language="en" /></div>;
  return <AuthCard title="Staff sign-in" description={null} providers={[]} className="max-w-none rounded-none border-0 p-0 shadow-none sm:p-0">
    <form className="flex flex-col gap-6" onSubmit={(event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      startTransition(async () => { try { const result = await staffLogin({ email: data.get("email"), password: data.get("password") }); setFailed(!result.ok); if (result.ok) setSignedIn(true); } catch { setFailed(true); } });
    }}>
      <Input label="Email" name="email" type="email" autoComplete="username" isRequired isDisabled={pending} />
      <Input label="Password" name="password" type="password" autoComplete="current-password" isRequired isDisabled={pending} />
      <p className="text-body-regular text-text-secondary">Prototype password: prototype</p>
      {failed ? <p role="alert" className="text-body-regular text-text-error-primary">The email or password is incorrect.</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
      <LinkButton href="/login" variant="secondary">Parent sign-in</LinkButton>
    </form>
  </AuthCard>;
}
