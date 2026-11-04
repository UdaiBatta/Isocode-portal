"use client";

// Adapted from https://reactbits.dev/r/CountUp-TS-TW.json
// Copyright (c) 2026 David Haz. MIT + Commons Clause; see ../LICENSE.md.
import { animate } from "motion/react";
import { useCallback, useEffect, useRef } from "react";
import { inr } from "@/lib/format";

export default function CountUp({ to, storageKey, format = "money" }: { to: number; storageKey: string; format?: "money" | "percent" | "integer" }) {
  const ref = useRef<HTMLSpanElement>(null);
  const formatValue = useCallback((value: number) => format === "money" ? inr(Math.round(value)) : format === "percent" ? `${Math.round(value * 10) / 10}%` : String(Math.round(value)), [format]);
  const exact = formatValue(to);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let previous: string | null = null;
    try { previous = sessionStorage.getItem(storageKey); sessionStorage.setItem(storageKey, String(to)); } catch { return; }
    const from = Number(previous);
    if (previous === null || !Number.isFinite(from) || from === to || matchMedia("(prefers-reduced-motion: reduce)").matches) { node.textContent = exact; return; }
    // Only the count mode is retained; first paint and completion always show exact paise.
    const control = animate(from, to, { duration: 0.5, ease: "easeOut", onUpdate: (value) => { node.textContent = formatValue(value); }, onComplete: () => { node.textContent = exact; } });
    return () => { control.stop(); node.textContent = exact; };
  }, [to, storageKey, formatValue, exact]);
  return <span ref={ref} aria-label={exact} data-counter={storageKey} className="tabular-nums">{exact}</span>;
}
