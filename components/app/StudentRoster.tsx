"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/application/data-table/data-table";
import { Avatar } from "@/components/base/avatar/avatar";
import { Chip, type ChipColor } from "@/components/base/badges/chip";
import { LinkButton } from "@/components/base/buttons/link-button";
import { Pagination } from "@/components/base/pagination/pagination";
import { SearchField } from "@/components/base/search-field/search-field";
import { Select, SelectItem } from "@/components/base/select/select";
import { Tab, TabList, TabPanel, Tabs } from "@/components/base/tabs/tabs";
import { EmptyState } from "./EmptyState";
import { ExportButtons } from "./ExportButtons";
import { StaffFrame, StaffPageHeader } from "./StaffPage";
import { dateLabel, inr } from "@/lib/format";
import { methodLabel } from "@/lib/i18n/checkout";
import type { StudentFilters, StudentRowVM, StudentsVM } from "@/lib/types";

type Directory = { centres: { id: string; name: string }[]; batches: { id: string; name: string; centreId: string }[] };

const tabs = [["all", "All"], ["overdue", "Overdue"], ["over60", "Over 60 days"], ["upcoming", "Upcoming"], ["clear", "Paid up"], ["checking", "Being checked"], ["withdrawn", "Withdrawn"]] as const;
const chips: Record<StudentRowVM["status"], [ChipColor, string]> = {
  overdue: ["rose", "Overdue"], upcoming: ["neutral", "Upcoming"], clear: ["lime", "Paid up"], checking: ["yellow", "Being checked"], withdrawn: ["gray", "Withdrawn"],
};
const initials = (name: string) => name.split(" ").map((part) => part[0]).slice(0, 2).join("");

export function StudentRoster({ view, directory, filters }: { view: StudentsVM; directory: Directory; filters: StudentFilters }) {
  const router = useRouter();
  const [query, setQuery] = useState(filters.q ?? "");
  const status = filters.status ?? "all";
  function navigate(patch: Partial<StudentFilters>) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, page: undefined, ...patch })) if (value) params.set(key, String(value));
    router.push(`/staff/students?${params}`);
  }
  const nextStep = (row: StudentRowVM) => row.next ? `Reminder ${dateLabel(row.next, "en", view.today)}` : row.stopped ?? (row.daysOverdue > 30 ? "Needs a call" : "None");
  const lastPayment = (row: StudentRowVM) => row.lastPayment ? <div className="flex flex-col"><span className="whitespace-nowrap">{dateLabel(row.lastPayment.on, "en", view.today)}</span><span className="text-body-2-regular whitespace-nowrap text-text-secondary">{methodLabel("en", row.lastPayment.method)}</span></div> : "None yet";
  const student = (row: StudentRowVM) => <div className="flex min-w-36 items-center gap-3">
    <Avatar size="md" initials={initials(row.name)} className="text-caption-1-semibold" aria-hidden="true" />
    <div className="flex min-w-0 flex-col items-start"><LinkButton href={`/staff/students/${row.code}`} variant="secondary">{row.name}</LinkButton><span className="text-body-2-regular text-text-secondary">{row.code}</span></div>
  </div>;
  const chip = (row: StudentRowVM) => <Chip color={chips[row.status][0]}>{chips[row.status][1]}</Chip>;
  const columns: ColumnDef<StudentRowVM>[] = [
    { accessorKey: "name", header: "Student", cell: ({ row }) => student(row.original) },
    { accessorKey: "batch", header: "Batch", cell: ({ row }) => <div className="flex flex-col"><span className="whitespace-nowrap">{row.original.batch}</span><span className="text-body-2-regular whitespace-nowrap text-text-secondary">{row.original.centre}</span></div> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => chip(row.original) },
    { accessorKey: "balance", header: "Outstanding", cell: ({ row }) => <span className="block whitespace-nowrap text-end tabular-nums">{inr(row.original.balance)}</span> },
    { accessorKey: "daysOverdue", header: "Overdue by", cell: ({ row }) => <span className="block whitespace-nowrap text-end tabular-nums">{row.original.daysOverdue ? `${row.original.daysOverdue} days` : "None"}</span> },
    { id: "next", header: "Next step", cell: ({ row }) => <span className="whitespace-nowrap">{nextStep(row.original)}</span> },
    { id: "last", header: "Last payment", cell: ({ row }) => lastPayment(row.original) },
  ];
  const batches = directory.batches.filter((batch) => !filters.centre || batch.centreId === filters.centre);
  return <>
    <StaffPageHeader title="Students" description={`${view.counts.all} students, most overdue first · ${dateLabel(view.today, "en", view.today)}`}><ExportButtons filters={{ centre: filters.centre, batch: filters.batch }} /></StaffPageHeader>
    <StaffFrame>
    <section className="flex flex-col gap-4 rounded-3xl border border-border-button-default p-4 md:p-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full min-w-0 md:w-72"><SearchField label="Search student" placeholder="Name or student code" value={query} onChange={setQuery} onSubmit={(value) => navigate({ q: value.trim() || undefined })} onClear={() => navigate({ q: undefined })} /></div>
        {view.canPickCentre ? <Select label="Centre" selectedKey={filters.centre ?? "all"} onSelectionChange={(key) => navigate({ centre: key === "all" ? undefined : String(key), batch: undefined })}><SelectItem id="all">All centres</SelectItem>{directory.centres.map((centre) => <SelectItem id={centre.id} key={centre.id}>{centre.name}</SelectItem>)}</Select> : null}
        <Select label="Batch" selectedKey={filters.batch ?? "all"} onSelectionChange={(key) => navigate({ batch: key === "all" ? undefined : String(key) })}><SelectItem id="all">All batches</SelectItem>{batches.map((batch) => <SelectItem id={batch.id} key={batch.id}>{filters.centre ? batch.name : `${batch.centreId} · ${batch.name}`}</SelectItem>)}</Select>
      </div>
      <Tabs selectedKey={status} onSelectionChange={(key) => navigate({ status: key === "all" ? undefined : String(key) as StudentFilters["status"] })}>
        <div className="overflow-x-auto"><TabList aria-label="Filter students by status" className="min-w-max">{tabs.map(([id, label]) => <Tab key={id} id={id} count={view.counts[id]}>{label}</Tab>)}</TabList></div>
        <TabPanel id={status} className="pt-4">
          {view.rows.length ? <DataTable data={view.rows} columns={columns} label="Students" renderCard={(row) => <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">{student(row)}{chip(row)}</div>
            <dl className="grid grid-cols-2 gap-3 text-body-2-regular">
              <div><dt className="text-text-secondary">Outstanding</dt><dd className="text-body-medium tabular-nums">{inr(row.balance)}</dd></div>
              <div><dt className="text-text-secondary">Overdue by</dt><dd className="text-body-medium tabular-nums">{row.daysOverdue ? `${row.daysOverdue} days` : "None"}</dd></div>
              <div><dt className="text-text-secondary">Next step</dt><dd>{nextStep(row)}</dd></div>
              <div><dt className="text-text-secondary">Last payment</dt><dd>{lastPayment(row)}</dd></div>
            </dl>
          </div>} /> : <EmptyState title="No matching students" />}
        </TabPanel>
      </Tabs>
      {view.pages > 1 ? <Pagination page={view.page} totalPages={view.pages} onChange={(page) => navigate({ page })} aria-label="Student pages" /> : null}
    </section>
    </StaffFrame>
  </>;
}
