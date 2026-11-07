"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/base/buttons/button";
import { FileUpload } from "@/components/base/file-upload/file-upload";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { Select, SelectItem } from "@/components/base/select/select";
import { toast } from "@/components/base/toast/toast";
import { StaffFrame, StaffPageHeader } from "./StaffPage";
import { uploadProgress, type UploadKind, type UploadResult } from "@/lib/actions/uploads";

const columns: Record<UploadKind, string> = {
  attendance: "student_code,week_start,attended,held",
  tests: "student_code,test_date,test_name,score,max_score",
};
const examples: Record<UploadKind, string> = {
  attendance: "STU-0587,2026-10-26,5,6",
  tests: "STU-0587,2026-10-28,Monthly Test 7,88,100",
};

export function ProgressUpload({ batches }: { batches: { id: string; label: string }[] }) {
  const [batchId, setBatchId] = useState<string | null>(batches[0]?.id ?? null);
  const [kind, setKind] = useState<UploadKind>("attendance");
  const [file, setFile] = useState<{ name: string; csv: string } | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  // Any change of batch, kind or file throws away the last check, so a save always matches what was checked.
  const reset = () => { setResult(null); setError(""); };
  function send(csv: string, commit: boolean) {
    if (!batchId) return;
    startTransition(async () => {
      try {
        const response = await uploadProgress({ batchId, kind, csv, commit });
        if (!response.ok) { setResult(null); setError(response.message); return; }
        setResult(response);
        if (response.applied) { toast.success(`Saved ${response.rows} rows`); setFile(null); }
      } catch { setError("Could not check the file. Please try again."); }
    });
  }
  const template = `data:text/csv;charset=utf-8,${encodeURIComponent(`${columns[kind]}\n${examples[kind]}\n`)}`;

  return <>
    <StaffPageHeader title="Upload results" description="Add a batch's weekly attendance or test scores from a CSV file. Nothing is saved until the whole file checks out." />
    <StaffFrame><section>
      <div className="flex flex-wrap items-end gap-4">
        <Select label="Batch" selectedKey={batchId} onSelectionChange={(key) => { setBatchId(String(key)); reset(); }}>
          {batches.map((batch) => <SelectItem id={batch.id} key={batch.id}>{batch.label}</SelectItem>)}
        </Select>
        <SegmentedControl aria-label="What the file holds" selectedKeys={[kind]} onSelectionChange={(keys) => { setKind(Array.from(keys)[0] as UploadKind); setFile(null); reset(); }}>
          <SegmentedControlItem id="attendance">Attendance</SegmentedControlItem>
          <SegmentedControlItem id="tests">Test scores</SegmentedControlItem>
        </SegmentedControl>
      </div>
      <p className="text-body-regular text-text-secondary">Columns, in this order: <code className="text-body-2-regular">{columns[kind]}</code>. <a className="underline" href={template} download={`${kind}-template.csv`}>Download a template</a>.</p>
      <FileUpload key={`${kind}-${batchId}`} allowedExtensions={["csv"]} maxBytes={1024 * 1024} onUploadComplete={async (chosen) => {
        reset(); const csv = await chosen.text(); setFile({ name: chosen.name, csv }); send(csv, false);
      }} />
      {pending ? <p role="status" className="text-body-regular text-text-secondary">Checking…</p> : null}
      {error ? <p role="alert" className="text-body-regular text-text-error-primary">{error}</p> : null}
      {result && !result.applied && file ? <div className="flex flex-col gap-3">
        {result.errors.length ? <>
          <p role="alert" className="text-body-medium text-text-error-primary">{result.errors.length} of {result.rows} rows need fixing. Nothing was saved.</p>
          <ul className="flex flex-col gap-1 text-body-2-regular">{result.errors.slice(0, 50).map((item) => <li key={`${item.line}-${item.message}`}>Line {item.line}: {item.message}</li>)}</ul>
          {result.errors.length > 50 ? <p className="text-body-2-regular text-text-secondary">And {result.errors.length - 50} more. Fix these first.</p> : null}
        </> : <>
          <p role="status" className="text-body-medium">{result.rows} rows in {file.name} are ready. Rows already on file for the same week or test are updated.</p>
          <Button className="self-start" disabled={pending} onClick={() => send(file.csv, true)}>Save {result.rows} rows</Button>
        </>}
      </div> : null}
    </section></StaffFrame>
  </>;
}
