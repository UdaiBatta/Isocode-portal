"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiCoinsLine, RiTimeLine, RiPercentLine, RiRefund2Line } from "@remixicon/react";
import type { ColumnDef } from "@tanstack/react-table";
import { StatCards } from "@/components/application/dashboard/stat-cards";
import { DataTable } from "@/components/application/data-table/data-table";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { Select, SelectItem } from "@/components/base/select/select";
import { SearchField } from "@/components/base/search-field/search-field";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/buttons/button-group";
import { LinkButton } from "@/components/base/buttons/link-button";
import { AgeingBar } from "./AgeingBar";
import { EmptyState } from "./EmptyState";
import { exportCsv } from "@/lib/actions/exports";
import { inr, dateLabel } from "@/lib/format";
import type { AgeingRow, DashboardVM } from "@/lib/types";

type Directory = { centres: { id: string; name: string }[]; students: { code: string; name: string }[] };
export function DuesDashboard({ view, directory, filters }: { view: DashboardVM; directory: Directory; filters: { group: "centre" | "batch"; centre?: string; batch?: string; q?: string } }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string[]>([]);
  const [query, setQuery] = useState(filters.q ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  function navigate(patch: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, ...patch })) if (value) params.set(key, value);
    router.push(`/staff/dashboard?${params}`);
  }
  function activate(row: AgeingRow) {
    if (row.kind === "centre") setExpanded((old) => old.includes(row.id) ? old.filter((id) => id !== row.id) : [...old, row.id]);
    else navigate({ batch: row.id });
  }
  const rows = view.rows.flatMap((row) => [row, ...(expanded.includes(row.id) ? row.children ?? [] : [])]);
  const moneyColumns = [["outstanding", "Outstanding"], ["notDue", "Not due"], ["d1_30", "1–30"], ["d31_60", "31–60"], ["d61_90", "61–90"], ["d90p", "90+"]] as const;
  const columns: ColumnDef<AgeingRow>[] = [
    { accessorKey: "label", header: "Centre / Batch", cell: ({ row }) => <div className="flex min-w-36 flex-col gap-2"><LinkButton variant="secondary" onClick={() => activate(row.original)} aria-expanded={row.original.kind === "centre" ? expanded.includes(row.original.id) : undefined}>{row.original.label}</LinkButton><AgeingBar row={row.original} /></div> },
    { accessorKey: "studentsWithDues", header: "Students", cell: ({ row }) => <span className="block text-end tabular-nums">{row.original.studentsWithDues}</span> },
    ...moneyColumns.map(([key, label]): ColumnDef<AgeingRow> => ({ accessorKey: key, header: label, cell: ({ row }) => <span className="block whitespace-nowrap text-end tabular-nums">{inr(row.original[key])}</span> })),
  ];
  const matches = filters.q ? directory.students.filter((student) => `${student.name} ${student.code}`.toLowerCase().includes(filters.q!.toLowerCase())) : view.students ?? [];
  function download(kind: "dues" | "receipts") {
    startTransition(async () => {
      setError(false);
      try { const result = await exportCsv(kind, filters); const url = URL.createObjectURL(new Blob([result.text], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = result.filename; anchor.click(); URL.revokeObjectURL(url); } catch { setError(true); }
    });
  }
  return <>
    <header className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-title-1-medium">Dues dashboard</h1><p className="mt-2 text-body-regular text-text-secondary">Across centres and batches · {dateLabel(view.today, "en", view.today)}</p></div></header>
    <StatCards stats={[
      { icon: RiCoinsLine, label: "Total outstanding", value: inr(view.totals.outstanding), delta: "Includes not due", deltaColor: "neutral" },
      { icon: RiTimeLine, label: "Overdue", value: inr(view.totals.overdue), delta: "Past due dates", deltaColor: "neutral" },
      { icon: RiPercentLine, label: "Over 60 days late", value: `${view.totals.over60Pct}%`, delta: "Target 6%", deltaColor: "neutral" },
      { icon: RiRefund2Line, label: "Refunds due", value: String(view.totals.refundsDue), delta: `${view.totals.refundsLate} past 10 days`, deltaColor: view.totals.refundsLate ? "rose" : "neutral" },
    ]} />
    <div className="flex flex-wrap items-end gap-4">
      <SegmentedControl aria-label="Group dues" selectedKeys={[filters.group]} onSelectionChange={(keys) => navigate({ group: String(Array.from(keys)[0]), batch: undefined })}><SegmentedControlItem id="centre">By centre</SegmentedControlItem><SegmentedControlItem id="batch">By batch</SegmentedControlItem></SegmentedControl>
      {view.canPickCentre ? <Select label="Centre" selectedKey={filters.centre ?? "all"} onSelectionChange={(key) => navigate({ centre: key === "all" ? undefined : String(key), batch: undefined })}><SelectItem id="all">All centres</SelectItem>{directory.centres.map((centre) => <SelectItem id={centre.id} key={centre.id}>{centre.name}</SelectItem>)}</Select> : null}
      <SearchField label="Search student" placeholder="Name or student code" value={query} onChange={setQuery} onSubmit={(value) => {
        const found = directory.students.filter((student) => `${student.name} ${student.code}`.toLowerCase().includes(value.trim().toLowerCase()));
        if (value.trim() && found.length === 1) router.push(`/staff/students/${found[0].code}`); else navigate({ q: value.trim() || undefined });
      }} />
    </div>
    {view.rows.length ? <DataTable data={rows} columns={columns} label="Dues ageing" renderCard={(row) => <div className="flex flex-col gap-4"><LinkButton variant="secondary" onClick={() => activate(row)}>{row.label}</LinkButton><div className="flex justify-between gap-4"><span>{row.studentsWithDues} students with dues</span><span className="text-headline-medium tabular-nums">{inr(row.outstanding)}</span></div><AgeingBar row={row} /><dl className="grid grid-cols-2 gap-3">{moneyColumns.slice(1).map(([key, label]) => <div key={key}><dt className="text-body-2-regular text-text-secondary">{label}</dt><dd className="text-body-regular tabular-nums">{inr(row[key])}</dd></div>)}</dl></div>} /> : <EmptyState title="No dues in this view" />}
    {filters.batch || filters.q ? <section className="flex flex-col gap-4"><h2 className="text-headline-medium">{filters.q ? "Search results" : "Students with dues"}</h2>{matches.length ? <ul className="divide-y divide-separator-border">{matches.map((student) => <li key={student.code}><LinkButton href={`/staff/students/${student.code}`} variant="secondary" className="w-full justify-between py-3"><span>{student.name} · {student.code}</span>{"balance" in student && typeof student.balance === "number" ? <span className="tabular-nums">{inr(student.balance)}</span> : null}</LinkButton></li>)}</ul> : <EmptyState title="No matching students" />}</section> : null}
    <div className="flex flex-col items-start gap-3"><ButtonGroup aria-label="Export accounts data"><ButtonGroupItem disabled={pending} onClick={() => download("dues")}>Export dues CSV</ButtonGroupItem><ButtonGroupItem disabled={pending} onClick={() => download("receipts")}>Export receipts CSV</ButtonGroupItem></ButtonGroup>{error ? <p role="alert" className="text-body-regular text-text-error-primary">Export failed. Please try again.</p> : null}</div>
  </>;
}
