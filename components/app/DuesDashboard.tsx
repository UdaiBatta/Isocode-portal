"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { RiArrowRightSLine, RiCoinsLine, RiTimeLine, RiPercentLine, RiRefund2Line } from "@remixicon/react";
import type { ColumnDef } from "@tanstack/react-table";
import { StatCards } from "@/components/application/dashboard/stat-cards";
import { DataTable } from "@/components/application/data-table/data-table";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { Select, SelectItem } from "@/components/base/select/select";
import { SearchField } from "@/components/base/search-field/search-field";
import { ButtonLink } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { AgeingBar, AgeingDistribution } from "./AgeingBar";
import { EmptyState } from "./EmptyState";
import CountUp from "@/components/vendor/reactbits/CountUp/CountUp";
import { ExportButtons } from "./ExportButtons";
import { StaffFrame, StaffPageHeader } from "./StaffPage";
import { inr, dateLabel } from "@/lib/format";
import { cx } from "@/utils/cx";
import type { AgeingRow, DashboardVM } from "@/lib/types";

type Directory = { centres: { id: string; name: string }[]; students: { code: string; name: string }[] };
export function DuesDashboard({ view, directory, filters, attention }: { view: DashboardVM; directory: Directory; filters: { group: "centre" | "batch"; centre?: string; batch?: string }; attention: { label: string; count: number; href: string }[] }) {
  const router = useRouter();
  const counterKey = `dues:${filters.centre ?? "all"}:${filters.batch ?? "all"}`;
  const [expanded, setExpanded] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  function navigate(patch: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, ...patch })) if (value) params.set(key, value);
    router.push(`/staff/dashboard?${params}`);
  }
  function activate(row: AgeingRow) {
    if (row.kind === "centre") setExpanded((old) => old.includes(row.id) ? old.filter((id) => id !== row.id) : [...old, row.id]);
    else router.push(`/staff/students?batch=${row.id}`);
  }
  const rows = view.rows.flatMap((row) => [row, ...(expanded.includes(row.id) ? row.children ?? [] : [])]);
  const moneyColumns = [["outstanding", "Outstanding"], ["notDue", "Not due"], ["d1_30", "1–30"], ["d31_60", "31–60"], ["d61_90", "61–90"], ["d90p", "90+"]] as const;
  const columns: ColumnDef<AgeingRow>[] = [
    { accessorKey: "label", header: "Centre / Batch", cell: ({ row }) => <div className={cx("flex min-w-36 flex-col gap-2", row.original.kind === "batch" && filters.group === "centre" && "ps-4")}><LinkButton variant="secondary" className="self-start" onClick={() => activate(row.original)} aria-expanded={row.original.kind === "centre" ? expanded.includes(row.original.id) : undefined}>{row.original.label}</LinkButton><AgeingBar row={row.original} /></div> },
    { accessorKey: "studentsWithDues", header: "Students", cell: ({ row }) => <span className="block text-end tabular-nums">{row.original.studentsWithDues}</span> },
    ...moneyColumns.map(([key, label]): ColumnDef<AgeingRow> => ({ accessorKey: key, header: label, cell: ({ row }) => {
      const value = row.original[key];
      const hot = key !== "outstanding" && key !== "notDue";
      const largest = hot ? Math.max(...rows.map((item) => item[key])) : 0;
      return <span className={cx("block whitespace-nowrap text-end tabular-nums", hot && "ledger-heat")} data-zero={hot && !value ? true : undefined} style={hot ? { "--heat": largest ? value / largest : 0 } as CSSProperties : undefined}>{inr(value)}</span>;
    } })),
  ];
  return <>
    <StaffPageHeader title="Dues dashboard" description={`Every centre and batch in one clear view, with what needs action first · ${dateLabel(view.today, "en", view.today)}`}><ExportButtons filters={filters} /><ButtonLink href="/staff/students">Open students</ButtonLink></StaffPageHeader>
    <StaffFrame>
    <StatCards className="stat-tape" stats={[
      { icon: RiCoinsLine, label: "Total outstanding", value: <CountUp to={view.totals.outstanding} storageKey={`${counterKey}:outstanding`} />, delta: "Includes not due", deltaColor: "neutral" },
      { icon: RiTimeLine, label: "Overdue", value: <CountUp to={view.totals.overdue} storageKey={`${counterKey}:overdue`} />, delta: "Past due dates", deltaColor: "neutral" },
      { icon: RiPercentLine, label: "Over 60 days late", value: <CountUp to={view.totals.over60Pct} format="percent" storageKey={`${counterKey}:late`} />, delta: "Target 6%", deltaColor: "neutral" },
      { icon: RiRefund2Line, label: "Refunds due", value: <CountUp to={view.totals.refundsDue} format="integer" storageKey={`${counterKey}:refunds`} />, delta: `${view.totals.refundsLate} past 10 days`, deltaColor: view.totals.refundsLate ? "rose" : "neutral" },
    ]} />
    {attention.length ? <nav aria-label="Needs attention" className="grid gap-3 md:grid-cols-3">{attention.map((item) => <a key={item.label} href={item.href} className="flex items-center justify-between gap-3 rounded-2xl border border-border-button-default bg-background-primary-default p-4 hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring focus-visible:outline-none"><span className="flex items-center gap-3"><span className="text-headline-medium tabular-nums">{item.count}</span><span className="text-body-regular text-text-secondary">{item.label}</span></span><RiArrowRightSLine size={20} aria-hidden="true" className="shrink-0 text-foreground-icon-secondary" /></a>)}</nav> : null}
    {view.rows.length ? <AgeingDistribution rows={view.rows} /> : null}
    <section className="flex flex-col gap-4 rounded-3xl border border-border-button-default p-4 md:p-5">
    <div className="flex flex-wrap items-end gap-4">
      <SegmentedControl aria-label="Group dues" selectedKeys={[filters.group]} onSelectionChange={(keys) => navigate({ group: String(Array.from(keys)[0]), batch: undefined })}><SegmentedControlItem id="centre">By centre</SegmentedControlItem><SegmentedControlItem id="batch">By batch</SegmentedControlItem></SegmentedControl>
      {view.canPickCentre ? <Select label="Centre" selectedKey={filters.centre ?? "all"} onSelectionChange={(key) => navigate({ centre: key === "all" ? undefined : String(key), batch: undefined })}><SelectItem id="all">All centres</SelectItem>{directory.centres.map((centre) => <SelectItem id={centre.id} key={centre.id}>{centre.name}</SelectItem>)}</Select> : null}
      <div className="min-w-0 flex-1 basis-full md:ms-auto md:max-w-xs md:basis-auto"><SearchField label="Search student" placeholder="Name or student code" value={query} onChange={setQuery} onSubmit={(value) => {
        const found = directory.students.filter((student) => `${student.name} ${student.code}`.toLowerCase().includes(value.trim().toLowerCase()));
        if (value.trim() && found.length === 1) router.push(`/staff/students/${found[0].code}`); else router.push(value.trim() ? `/staff/students?q=${encodeURIComponent(value.trim())}` : "/staff/students");
      }} /></div>
    </div>
    {view.rows.length ? <DataTable data={rows} columns={columns} label="Dues ageing" renderCard={(row) => <div className="flex flex-col gap-4"><LinkButton variant="secondary" className="self-start" onClick={() => activate(row)}>{row.label}</LinkButton><div className="flex justify-between gap-4"><span>{row.studentsWithDues} students with dues</span><span className="text-headline-medium tabular-nums">{inr(row.outstanding)}</span></div><AgeingBar row={row} /><dl className="grid grid-cols-2 gap-3">{moneyColumns.slice(1).map(([key, label]) => <div key={key}><dt className="text-body-2-regular text-text-secondary">{label}</dt><dd className="text-body-regular tabular-nums">{inr(row[key])}</dd></div>)}</dl></div>} /> : <EmptyState title="No dues in this view" />}
    </section>
    </StaffFrame>
  </>;
}
