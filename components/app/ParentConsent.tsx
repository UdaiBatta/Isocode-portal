"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AuthCardFrame as AuthCard } from "@/components/application/auth/auth-card-frame";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Button } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { grantConsent, declineConsent } from "@/lib/actions/auth";
import { LogoutButton } from "./LogoutButton";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/types";

export function ParentConsent({ language, students, declined, next }: { language: Language; students: { id: string; name: string }[]; declined: boolean; next: string }) {
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const names = students.map((student) => student.name).join(" / ");
  if (declined) return <div className="flex flex-col gap-8"><p className="text-headline-regular">{t(language, "consent.declined")}</p><LogoutButton language={language} /></div>;
  return <AuthCard title={t(language, "consent.title")} description={null} className="max-w-none rounded-none border-0 p-0 shadow-none sm:p-0 [&_h1]:text-title-1-medium">
    <form onSubmit={(event) => { event.preventDefault(); if (!agree || pending) return; startTransition(async () => {
      try { const result = await grantConsent({ studentIds: students.map((student) => student.id), wordingVersion: "v1" }); if (result.ok) { router.push(next); router.refresh(); } else setFailed(true); }
      catch { setFailed(true); }
    }); }} className="flex flex-col gap-6" aria-busy={pending}>
      <p className="text-headline-regular text-text-secondary">{t(language, "consent.body", { student: names })}</p>
      <ul className="flex list-disc flex-col gap-3 ps-5 text-headline-regular">{(["consent.p1", "consent.p2", "consent.p3", "consent.p4"] as const).map((key) => <li key={key}>{t(language, key)}</li>)}</ul>
      <Checkbox isSelected={agree} onChange={setAgree} isDisabled={pending} className="min-h-12 items-start py-3"><span className="text-body-regular">{t(language, "consent.check", { student: names })}</span></Checkbox>
      {failed ? <p role="alert" className="text-body-regular text-text-error-primary">{t(language, "common.loadFailed")}</p> : null}
      <Button type="submit" disabled={!agree || pending} className="w-full text-headline-medium">{t(language, pending ? "common.loading" : "consent.agree")}</Button>
      <LinkButton variant="secondary" disabled={pending} onClick={() => startTransition(async () => {
        try { const result = await declineConsent(); if (result.ok) router.refresh(); else setFailed(true); }
        catch { setFailed(true); }
      })}>{t(language, "consent.decline")}</LinkButton>
    </form>
  </AuthCard>;
}
