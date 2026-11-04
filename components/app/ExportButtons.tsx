"use client";

import { useState, useTransition } from "react";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/buttons/button-group";
import { exportCsv } from "@/lib/actions/exports";

export function ExportButtons({ filters }: { filters: { centre?: string; batch?: string } }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  function download(kind: "dues" | "receipts") {
    startTransition(async () => {
      setError(false);
      try { const result = await exportCsv(kind, filters); const url = URL.createObjectURL(new Blob([result.text], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = result.filename; anchor.click(); URL.revokeObjectURL(url); } catch { setError(true); }
    });
  }
  return <div className="flex flex-col items-start gap-2 md:items-end">
    <ButtonGroup aria-label="Export accounts data"><ButtonGroupItem disabled={pending} onClick={() => download("dues")}>Export dues CSV</ButtonGroupItem><ButtonGroupItem disabled={pending} onClick={() => download("receipts")}>Export receipts CSV</ButtonGroupItem></ButtonGroup>
    {error ? <p role="alert" className="text-body-regular text-text-error-primary">Export failed. Please try again.</p> : null}
  </div>;
}
