"use client";

import { useRouter } from "next/navigation";
import { LinkButton } from "@/components/base/buttons/link-button";
import { Pagination } from "@/components/base/pagination/pagination";
import { Select, SelectItem } from "@/components/base/select/select";
import { EmptyState } from "./EmptyState";
import { StaffFrame, StaffPageHeader } from "./StaffPage";
import { dateLabel, inr } from "@/lib/format";
import type { ChangeFilters, ChangeVM, ManageEntity } from "@/lib/types";

const entities: [ManageEntity, string][] = [["student", "Students"], ["batch", "Batches"], ["centre", "Centres"], ["staff", "Staff"]];
const verbs: Record<ChangeVM["action"], string> = { create: "Added", update: "Edited", fee: "Changed fee", archive: "Archived", restore: "Restored", delete: "Deleted" };
const fields: Record<string, string> = {
  name: "Name", fullName: "Name", code: "Code", batchId: "Batch", centreId: "Centre", enrolledOn: "Enrolled on", guardianName: "Guardian", guardianPhone: "Guardian mobile",
  guardianLanguage: "Reminder language", gross: "Course fee", discount: "Discount", discountReason: "Discount reason", stream: "Exam", sessionStart: "Session starts",
  sessionEnd: "Session ends", email: "Email", role: "Role", state: "Status",
};
const money = new Set(["gross", "discount"]);
const shown = (field: string, value: string | number | null) => value === null || value === "" ? "none" : money.has(field) && typeof value === "number" ? inr(value) : String(value);
const time = (at: string) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(at));

export function ManageHistory({ view, filters }: { view: { today: string; rows: ChangeVM[]; page: number; pages: number }; filters: ChangeFilters }) {
  const router = useRouter();
  const navigate = (patch: Partial<ChangeFilters>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, page: undefined, ...patch })) if (value) params.set(key, String(value));
    router.push(`/staff/manage/history?${params}`);
  };
  return <>
    <StaffPageHeader title="Change history" description="Every add, edit, fee change, archive and delete, newest first. Payments and receipts are never edited." />
    <StaffFrame><section>
      <div className="flex flex-wrap items-end gap-4">
        <Select label="Record type" selectedKey={filters.entity ?? "all"} onSelectionChange={(key) => navigate({ entity: key === "all" ? undefined : key as ManageEntity, id: undefined })}>
          <SelectItem id="all">All records</SelectItem>{entities.map(([id, label]) => <SelectItem id={id} key={id}>{label}</SelectItem>)}
        </Select>
        {filters.id ? <LinkButton variant="secondary" href={`/staff/manage/history${filters.entity ? `?entity=${filters.entity}` : ""}`}>Show all {filters.entity ?? "record"} changes</LinkButton> : null}
      </div>
      {view.rows.length ? <ol className="flex flex-col divide-y divide-separator-border" aria-label="Changes">
        {view.rows.map((row) => <li key={row.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-body-medium">{verbs[row.action]} <span className="text-text-secondary">{row.entity}</span> {row.label}</p>
            <p className="text-body-2-regular text-text-secondary">{dateLabel(row.at.slice(0, 10), "en", view.today)}, {time(row.at)} · {row.actor}</p>
          </div>
          {row.changes.length ? <ul className="flex flex-col gap-1 text-body-2-regular">
            {row.changes.filter((change) => row.action !== "fee" || change.field !== "discountReason").map((change) => <li key={change.field}><span className="text-text-secondary">{fields[change.field] ?? change.field}:</span> <span className="tabular-nums">{shown(change.field, change.before)} → {shown(change.field, change.after)}</span></li>)}
          </ul> : null}
          {row.reason ? <p className="text-body-2-regular text-text-secondary">Reason: {row.reason}</p> : null}
        </li>)}
      </ol> : <EmptyState title="No changes recorded yet" description={filters.entity || filters.id ? "Try all records." : undefined} />}
      {view.pages > 1 ? <Pagination page={view.page} totalPages={view.pages} onChange={(page) => navigate({ page })} aria-label="History pages" /> : null}
    </section></StaffFrame>
  </>;
}
