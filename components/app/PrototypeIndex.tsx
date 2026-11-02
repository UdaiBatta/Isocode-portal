"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LinkButton } from "@/components/base/buttons/link-button";
import { prototypeRoutes } from "@/lib/prototype-routes";
import { openPrototypeRoute } from "@/lib/actions/prototype";

export function PrototypeIndex() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return <><p className="text-body-regular text-text-secondary">Links prepare the sample role in this browser. Payment result records a successful mock attempt; other links preserve your demo changes.</p>{error ? <p role="alert" className="text-body-regular text-text-error-primary">{error}</p> : null}<ul className="grid gap-5 md:grid-cols-2">{prototypeRoutes.map((route) => <li key={route.key} className="flex flex-col gap-3 rounded-3xl border border-border-button-default p-5"><h2 className="text-headline-medium">{route.title}</h2><p className="break-all text-body-2-regular text-text-secondary">{route.path}</p><div className="flex flex-wrap gap-4">{(["normal", "loading", "empty", "error"] as const).map((state) => <LinkButton key={state} href={`${route.path}${state === "normal" ? "" : `?state=${state}`}`} aria-label={`${route.title} · ${state}`} disabled={pending} variant="secondary" onClick={(event) => { event.preventDefault(); startTransition(async () => { setError(""); try { const result = await openPrototypeRoute({ key: route.key, state }); if (!result.ok) { setError(result.message); return; } router.push(result.next); router.refresh(); } catch { setError("Could not open this prototype screen. Please try again."); } }); }}>{state[0].toUpperCase() + state.slice(1)}</LinkButton>)}</div></li>)}</ul></>;
}
