"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { parseDate } from "@internationalized/date";
import type { ColumnDef } from "@tanstack/react-table";
import { RiAddLine } from "@remixicon/react";
import { DataTable } from "@/components/application/data-table/data-table";
import { Chip } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { DatePicker } from "@/components/base/date-picker/date-picker";
import { Input } from "@/components/base/input/input";
import { AlertDialog, Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/base/modal/modal";
import { Pagination } from "@/components/base/pagination/pagination";
import { SearchField } from "@/components/base/search-field/search-field";
import { Select, SelectItem } from "@/components/base/select/select";
import { Tab, TabList, TabPanel, Tabs } from "@/components/base/tabs/tabs";
import { toast } from "@/components/base/toast/toast";
import { EmptyState } from "./EmptyState";
import { StaffFrame, StaffPageHeader } from "./StaffPage";
import { archiveRecord, changeFee, deleteRecord, restoreRecord, saveBatch, saveCentre, saveStaff, saveStudent } from "@/lib/actions/admin";
import { dateLabel, inr, phoneLabel, rupeesToPaise } from "@/lib/format";
import type { AdminBatchVM, AdminCentreVM, AdminDirectoryVM, AdminFilters, AdminListVM, AdminStaffVM, AdminStudentVM, ManageEntity, RecordActions, RecordState } from "@/lib/types";

export type ManageSection = "students" | "batches" | "centres" | "staff";
type AnyRow = AdminStudentVM | AdminBatchVM | AdminCentreVM | AdminStaffVM;
type Result = { ok: true } | { ok: false; message: string };
type Field = { name: string; label: string; kind?: "text" | "email" | "tel" | "password" | "money" | "date" | "select"; hint?: string; optional?: boolean; createOnly?: boolean; options?: [string, string][] };
interface Config {
  entity: ManageEntity; title: string; noun: string; description: string; search: string;
  columns: ColumnDef<AnyRow>[]; fields: Field[]; values: (row: AnyRow) => Record<string, string>;
  save: (input: Record<string, unknown>) => Promise<Result>;
}

const paise = (value: string) => value.trim() && Number(value) !== 0 ? rupeesToPaise(value.trim()) : 0;
const rupees = (value: number) => String(value / 100);
const roles: [string, string][] = [["accounts", "Accounts"], ["counsellor", "Counsellor"], ["admin", "Admin"]];
const stateChip = (row: AnyRow) => row.state === "archived" ? <Chip color="gray">Archived</Chip> : "status" in row && row.status === "withdrawn" ? <Chip color="rose">Withdrawn</Chip> : <Chip color="lime">Active</Chip>;
const stack = (top: ReactNode, bottom: ReactNode) => <div className="flex flex-col"><span className="whitespace-nowrap">{top}</span><span className="text-body-2-regular whitespace-nowrap text-text-secondary">{bottom}</span></div>;

function configs(directory: AdminDirectoryVM, today: string): Record<ManageSection, Config> {
  const centres = directory.centres.map(({ id, name }): [string, string] => [id, name]);
  const centreName = (id: string) => directory.centres.find((item) => item.id === id)?.name ?? id;
  const batches = directory.batches.map(({ id, name, centreId }): [string, string] => [id, `${centreName(centreId)} · ${name}`]);
  return {
    students: {
      entity: "student", title: "Students", noun: "student", search: "Name, code or guardian phone",
      description: "Enrolment, batch and guardian details. Withdrawals go through the refund flow.",
      columns: [
        { id: "name", header: "Student", cell: ({ row }) => { const s = row.original as AdminStudentVM; return stack(s.name, s.code); } },
        { id: "batch", header: "Batch", cell: ({ row }) => { const s = row.original as AdminStudentVM; return stack(s.batch, s.centre); } },
        { id: "guardian", header: "Guardian", cell: ({ row }) => { const s = row.original as AdminStudentVM; return stack(s.guardian.name, <bdi dir="ltr">{phoneLabel(s.guardian.phone)}</bdi>); } },
        { id: "fee", header: "Net fee", meta: { numeric: true }, cell: ({ row }) => { const s = row.original as AdminStudentVM; return stack(<span className="tabular-nums">{inr(s.fee.net)}</span>, <span className="tabular-nums">{inr(s.fee.paid)} paid</span>); } },
        { id: "state", header: "Status", cell: ({ row }) => stateChip(row.original) },
      ],
      fields: [
        { name: "fullName", label: "Student name" },
        { name: "batchId", label: "Batch", kind: "select", options: batches },
        { name: "enrolledOn", label: "Enrolled on", kind: "date" },
        { name: "guardianName", label: "Guardian name" },
        { name: "guardianPhone", label: "Guardian mobile", kind: "tel", hint: "+91 and 10 digits, for OTP sign-in and reminders" },
        { name: "guardianLanguage", label: "Reminder language", kind: "select", options: [["hi", "हिन्दी (Hindi)"], ["en", "English"]] },
        { name: "gross", label: "Course fee (₹)", kind: "money", createOnly: true },
        { name: "discount", label: "Discount (₹)", kind: "money", createOnly: true, optional: true },
        { name: "discountReason", label: "Discount reason", createOnly: true, optional: true, hint: "Required when there is a discount" },
      ],
      values: (row) => { const s = row as AdminStudentVM; return { fullName: s.name, batchId: s.batchId, enrolledOn: s.enrolledOn, guardianName: s.guardian.name, guardianPhone: s.guardian.phone, guardianLanguage: s.guardian.language }; },
      save: saveStudent,
    },
    batches: {
      entity: "batch", title: "Batches", noun: "batch", search: "Batch or centre",
      description: "Each batch carries its course: exam stream and session dates.",
      columns: [
        { id: "name", header: "Batch", cell: ({ row }) => { const b = row.original as AdminBatchVM; return stack(b.name, b.stream); } },
        { id: "centre", header: "Centre", cell: ({ row }) => (row.original as AdminBatchVM).centre },
        { id: "session", header: "Session", cell: ({ row }) => { const b = row.original as AdminBatchVM; return stack(dateLabel(b.sessionStart, "en", today), `to ${dateLabel(b.sessionEnd, "en", today)}`); } },
        { id: "students", header: "Students", meta: { numeric: true }, cell: ({ row }) => <span className="tabular-nums">{(row.original as AdminBatchVM).students}</span> },
        { id: "state", header: "Status", cell: ({ row }) => stateChip(row.original) },
      ],
      fields: [
        { name: "centreId", label: "Centre", kind: "select", options: centres },
        { name: "stream", label: "Exam", kind: "select", options: [["JEE", "JEE"], ["NEET", "NEET"]] },
        { name: "examYear", label: "Exam year", hint: "For example 2028. The batch is named exam, year and timing." },
        { name: "timing", label: "Timing", kind: "select", options: [["Morning", "Morning"], ["Evening", "Evening"]] },
        { name: "sessionStart", label: "Session starts", kind: "date" },
        { name: "sessionEnd", label: "Session ends", kind: "date" },
      ],
      values: (row) => { const b = row as AdminBatchVM; const [, examYear, timing] = b.name.split(" "); return { examYear, timing, centreId: b.centreId, stream: b.stream, sessionStart: b.sessionStart, sessionEnd: b.sessionEnd }; },
      save: saveBatch,
    },
    centres: {
      entity: "centre", title: "Centres", noun: "centre", search: "Centre name or code",
      description: "Centres scope accounts staff and number their receipts.",
      columns: [
        { id: "name", header: "Centre", cell: ({ row }) => { const c = row.original as AdminCentreVM; return stack(c.name, c.code); } },
        { id: "batches", header: "Batches", meta: { numeric: true }, cell: ({ row }) => <span className="tabular-nums">{(row.original as AdminCentreVM).batches}</span> },
        { id: "students", header: "Students", meta: { numeric: true }, cell: ({ row }) => <span className="tabular-nums">{(row.original as AdminCentreVM).students}</span> },
        { id: "staff", header: "Staff", meta: { numeric: true }, cell: ({ row }) => <span className="tabular-nums">{(row.original as AdminCentreVM).staff}</span> },
        { id: "state", header: "Status", cell: ({ row }) => stateChip(row.original) },
      ],
      fields: [
        { name: "name", label: "Centre name" },
        { name: "code", label: "Centre code", createOnly: true, hint: "3 capital letters. Receipt numbers use it, so it cannot change later." },
      ],
      values: (row) => ({ name: (row as AdminCentreVM).name }),
      save: saveCentre,
    },
    staff: {
      entity: "staff", title: "Staff", noun: "staff account", search: "Name or email",
      description: "Who can sign in, their role and their centre.",
      columns: [
        { id: "name", header: "Name", cell: ({ row }) => { const s = row.original as AdminStaffVM; return stack(s.fullName, <bdi dir="ltr">{s.email}</bdi>); } },
        { id: "role", header: "Role", cell: ({ row }) => roles.find(([id]) => id === (row.original as AdminStaffVM).role)?.[1] },
        { id: "centre", header: "Centre", cell: ({ row }) => (row.original as AdminStaffVM).centre ?? "All centres" },
        { id: "state", header: "Status", cell: ({ row }) => stateChip(row.original) },
      ],
      fields: [
        { name: "fullName", label: "Full name" },
        { name: "email", label: "Email", kind: "email" },
        { name: "role", label: "Role", kind: "select", options: roles },
        { name: "centreId", label: "Centre", kind: "select", options: [["all", "All centres (admins only)"], ...centres] },
        { name: "password", label: "Temporary password", kind: "password", createOnly: true, hint: "At least 12 characters. Share it in person." },
      ],
      values: (row) => { const s = row as AdminStaffVM; return { fullName: s.fullName, email: s.email, role: s.role, centreId: s.centreId ?? "all" }; },
      save: saveStaff,
    },
  };
}

function toInput(section: ManageSection, data: FormData, row: AnyRow | null) {
  const value = Object.fromEntries([...data.entries()].map(([key, item]) => [key, String(item).trim()])) as Record<string, string>;
  const input: Record<string, unknown> = { ...value, id: row?.id };
  if (section === "students" && !row) Object.assign(input, { gross: paise(value.gross), discount: paise(value.discount ?? ""), discountReason: value.discountReason || undefined });
  if (section === "batches" && !/^20d{2}$/.test(value.examYear)) throw new Error("Enter the exam year as 4 digits, for example 2028.");
  if (section === "batches") { input.name = `${value.stream} ${value.examYear} ${value.timing}`; delete input.examYear; delete input.timing; }
  if (section === "centres" && row) input.code = (row as AdminCentreVM).code;
  if (section === "centres") input.code = String(input.code).toUpperCase();
  if (section === "staff") Object.assign(input, { centreId: value.centreId === "all" ? null : value.centreId, password: value.password || undefined });
  return input;
}

function FormField({ field, value, disabled }: { field: Field; value?: string; disabled: boolean }) {
  const [date, setDate] = useState(() => field.kind === "date" && value ? parseDate(value) : null);
  if (field.kind === "select") return <Select label={field.label} name={field.name} defaultSelectedKey={value ?? null} isRequired={!field.optional} isDisabled={disabled} placeholder="Choose" className="w-full" triggerClassName="w-full">
    {(field.options ?? []).map(([id, label]) => <SelectItem id={id} key={id}>{label}</SelectItem>)}
  </Select>;
  if (field.kind === "date") return <div className="flex flex-col gap-1.5"><p className="text-body-medium">{field.label}</p>
    <DatePicker aria-label={field.label} value={date} onChange={setDate} isDisabled={disabled} /><input type="hidden" name={field.name} value={date?.toString() ?? ""} /></div>;
  return <Input label={field.label} name={field.name} hint={field.hint} defaultValue={value} isRequired={!field.optional} isDisabled={disabled}
    type={field.kind === "money" ? "text" : field.kind ?? "text"} inputMode={field.kind === "money" ? "decimal" : undefined} inputDir={field.kind === "tel" || field.kind === "email" ? "ltr" : undefined}
    autoComplete={field.kind === "password" ? "new-password" : "off"} placeholder={field.kind === "tel" ? "+919876543210" : undefined} />;
}

type Confirm = { kind: "archive" | "restore" | "delete"; row: AnyRow } | null;
const lifecycleCopy = {
  archive: ["Archive", "It leaves the active lists but keeps every payment, receipt and change. You can restore it later."],
  restore: ["Restore", "It returns to the active lists."],
  delete: ["Delete", "This removes the record for good. Only records with no payments or receipts can be deleted."],
} as const;

export function ManageWorkspace({ section, view, directory, filters }: { section: ManageSection; view: AdminListVM<AnyRow>; directory: AdminDirectoryVM; filters: AdminFilters }) {
  const router = useRouter();
  const config = configs(directory, view.today)[section];
  const [query, setQuery] = useState(filters.q ?? "");
  const [editing, setEditing] = useState<AnyRow | "new" | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const state = filters.state ?? "active";
  const row = editing === "new" ? null : editing;

  function navigate(patch: Partial<AdminFilters>) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, page: undefined, ...patch })) if (value) params.set(key, String(value));
    router.push(`/staff/manage/${section}?${params}`);
  }
  async function run(action: () => Promise<Result>, done: string) {
    setError(""); setPending(true);
    try {
      const result = await action();
      if (!result.ok) { setError(result.message); return false; }
      toast.success(done); setEditing(null); router.refresh(); return true;
    } catch { setError("Could not save. Check the values and try again."); return false; }
    finally { setPending(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const missing = config.fields.find((field) => field.kind === "date" && !data.get(field.name));
    if (missing) { setError(`${missing.label}: choose a date.`); return; }
    let input: Record<string, unknown>;
    try { input = toInput(section, data, row); } catch (problem) { setError(problem instanceof Error ? problem.message : "Check the values."); return; }
    void run(() => config.save(input), row ? "Changes saved" : `${config.noun[0].toUpperCase()}${config.noun.slice(1)} added`);
  }
  const open = (item: AnyRow) => { setError(""); setEditing(item); };
  const name = (item: AnyRow) => "fullName" in item ? item.fullName : item.name;
  const columns: ColumnDef<AnyRow>[] = [
    ...config.columns,
    { id: "open", header: "Action", cell: ({ row: item }) => <Button variant="secondary" size="small" onClick={() => open(item.original)} aria-label={`${item.original.actions.canEdit ? "Edit" : "View"} ${name(item.original)}`}>{item.original.actions.canEdit ? "Edit" : "View"}</Button> },
  ];
  const centreFilter = section !== "centres" ? <Select label="Centre" selectedKey={filters.centre ?? "all"} onSelectionChange={(key) => navigate({ centre: key === "all" ? undefined : String(key), batch: undefined })}><SelectItem id="all">All centres</SelectItem>{directory.centres.map((centre) => <SelectItem id={centre.id} key={centre.id}>{centre.name}</SelectItem>)}</Select> : null;
  const batchFilter = section === "students" ? <Select label="Batch" selectedKey={filters.batch ?? "all"} onSelectionChange={(key) => navigate({ batch: key === "all" ? undefined : String(key) })}><SelectItem id="all">All batches</SelectItem>{directory.batches.filter((batch) => !filters.centre || batch.centreId === filters.centre).map((batch) => <SelectItem id={batch.id} key={batch.id}>{filters.centre ? batch.name : `${batch.centreId} · ${batch.name}`}</SelectItem>)}</Select> : null;

  return <>
    <StaffPageHeader title={config.title} description={config.description}>
      <Button leadingIcon={RiAddLine} onClick={() => { setError(""); setEditing("new"); }}>Add {config.noun}</Button>
    </StaffPageHeader>
    <StaffFrame><section>
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full min-w-0 md:w-72"><SearchField label={`Search ${config.title.toLowerCase()}`} placeholder={config.search} value={query} onChange={setQuery} onSubmit={(value) => navigate({ q: value.trim() || undefined })} onClear={() => navigate({ q: undefined })} /></div>
        {centreFilter}{batchFilter}
      </div>
      <Tabs selectedKey={state} onSelectionChange={(key) => navigate({ state: key === "active" ? undefined : key as RecordState })}>
        <TabList aria-label={`Filter ${config.title.toLowerCase()} by status`}><Tab id="active" count={view.counts.active}>Active</Tab><Tab id="archived" count={view.counts.archived}>Archived</Tab></TabList>
        <TabPanel id={state} className="pt-4">
          {view.rows.length ? <DataTable data={view.rows} columns={columns} label={config.title} renderCard={(item) => <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">{stack(name(item), "code" in item ? item.code : "email" in item ? <bdi dir="ltr">{item.email}</bdi> : item.centre)}{stateChip(item)}</div>
            <dl className="grid grid-cols-2 gap-3 text-body-2-regular">{config.columns.slice(1, -1).map((column) => <div key={column.id} className="min-w-0"><dt className="text-text-secondary">{String(column.header)}</dt><dd className="[&_*]:whitespace-normal">{(column.cell as (context: { row: { original: AnyRow } }) => ReactNode)({ row: { original: item } })}</dd></div>)}</dl>
            <Button variant="secondary" size="small" className="self-start" onClick={() => open(item)} aria-label={`${item.actions.canEdit ? "Edit" : "View"} ${name(item)}`}>{item.actions.canEdit ? "Edit" : "View"}</Button>
          </div>} /> : <EmptyState title={state === "archived" ? `No archived ${config.title.toLowerCase()}` : `No matching ${config.title.toLowerCase()}`} description={filters.q ? "Try another search." : undefined} />}
        </TabPanel>
      </Tabs>
      {view.pages > 1 ? <Pagination page={view.page} totalPages={view.pages} onChange={(page) => navigate({ page })} aria-label={`${config.title} pages`} /> : null}
    </section></StaffFrame>

    <Modal size="lg" isOpen={editing !== null} onOpenChange={(isOpen) => { if (!isOpen) setEditing(null); }}>
      <form onSubmit={submit} className="contents">
        <ModalHeader title={row ? name(row) : `Add ${config.noun}`} description={row && "code" in row ? row.code : undefined} />
        <ModalBody className="flex flex-col gap-4">
          {config.fields.filter((field) => !row || !field.createOnly).map((field) => <FormField key={`${row?.id ?? "new"}-${field.name}`} field={field} value={row ? config.values(row)[field.name] : undefined} disabled={pending || (!!row && !row.actions.canEdit)} />)}
          {row && section === "students" ? <FeePanel student={row as AdminStudentVM} onSave={(input) => run(() => changeFee(input), "Fee changed")} pending={pending} /> : null}
          {row ? <Lifecycle actions={row.actions} entity={config.entity} id={row.id} onPick={(kind) => { setEditing(null); setConfirm({ kind, row }); }} /> : null}
          {error ? <p role="alert" className="text-body-regular text-text-error-primary">{error}</p> : null}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" type="button" onClick={() => setEditing(null)}>{row && !row.actions.canEdit ? "Close" : "Cancel"}</Button>
          {!row || row.actions.canEdit ? <Button type="submit" disabled={pending}>{row ? "Save changes" : `Add ${config.noun}`}</Button> : null}
        </ModalFooter>
      </form>
    </Modal>

    <AlertDialog isOpen={confirm !== null} onOpenChange={(isOpen) => { if (!isOpen) setConfirm(null); }}
      title={confirm ? `${lifecycleCopy[confirm.kind][0]} ${name(confirm.row)}?` : ""} description={confirm ? lifecycleCopy[confirm.kind][1] : ""}
      variant={confirm?.kind === "delete" ? "danger" : "default"} confirmLabel={confirm ? lifecycleCopy[confirm.kind][0] : ""}
      onConfirm={async () => {
        if (!confirm) return;
        const action = { archive: archiveRecord, restore: restoreRecord, delete: deleteRecord }[confirm.kind];
        const result = await action({ entity: config.entity, id: confirm.row.id });
        if (!result.ok) { toast.error(result.message); throw new Error(result.message); }
        toast.success(`${lifecycleCopy[confirm.kind][0].replace(/e$/, "")}ed ${name(confirm.row)}`); setConfirm(null); router.refresh();
      }} />
  </>;
}

function Lifecycle({ actions, entity, id, onPick }: { actions: RecordActions; entity: ManageEntity; id: string; onPick: (kind: "archive" | "restore" | "delete") => void }) {
  const offered = (["restore", "archive", "delete"] as const).filter((kind) => actions[({ archive: "canArchive", restore: "canRestore", delete: "canDelete" } as const)[kind]]);
  return <div className="flex flex-col gap-3 border-t border-separator-border pt-4">
    <h3 className="text-headline-medium">Record</h3>
    {actions.blockedReason ? <p className="text-body-regular text-text-secondary">{actions.blockedReason}</p> : null}
    <div className="flex flex-wrap gap-3">
      {offered.map((kind) => <Button key={kind} type="button" variant={kind === "delete" ? "danger" : "secondary"} onClick={() => onPick(kind)}>{lifecycleCopy[kind][0]}</Button>)}
      <LinkButton variant="secondary" href={`/staff/manage/history?entity=${entity}&id=${encodeURIComponent(id)}`}>Change history</LinkButton>
    </div>
  </div>;
}

function FeePanel({ student, onSave, pending }: { student: AdminStudentVM; onSave: (input: unknown) => Promise<boolean>; pending: boolean }) {
  const [editing, setEditing] = useState(false);
  const [problem, setProblem] = useState("");
  const [values, setValues] = useState({ gross: rupees(student.fee.gross), discount: rupees(student.fee.discount), reason: "" });
  async function save() {
    setProblem("");
    if (values.reason.trim().length < 5) { setProblem("Give a reason of at least 5 characters."); return; }
    try { if (await onSave({ studentId: student.id, gross: paise(values.gross), discount: paise(values.discount), reason: values.reason.trim() })) setEditing(false); }
    catch (error) { setProblem(error instanceof Error ? error.message : "Check the amounts."); }
  }
  const { fee } = student;
  return <div className="flex flex-col gap-3 border-t border-separator-border pt-4">
    <h3 className="text-headline-medium">Fee</h3>
    <dl className="grid grid-cols-2 gap-3 text-body-2-regular sm:grid-cols-4">
      {([["Course fee", fee.gross], ["Discount", fee.discount], ["Net fee", fee.net], ["Paid", fee.paid]] as const).map(([label, value]) => <div key={label}><dt className="text-text-secondary">{label}</dt><dd className="text-body-medium tabular-nums">{inr(value)}</dd></div>)}
    </dl>
    {fee.discountReason ? <p className="text-body-2-regular text-text-secondary">Discount reason: {fee.discountReason}</p> : null}
    {!fee.editable ? <p className="text-body-regular text-text-secondary">{fee.lockedReason}</p> : !editing ? <Button type="button" variant="secondary" className="self-start" onClick={() => setEditing(true)}>Change fee or discount</Button> : <>
      <p className="text-body-2-regular text-text-secondary">Only the unpaid instalments change. The net fee cannot drop below {inr(fee.paid)} already paid.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Course fee (₹)" inputMode="decimal" value={values.gross} onChange={(gross) => setValues({ ...values, gross })} isDisabled={pending} />
        <Input label="Discount (₹)" inputMode="decimal" value={values.discount} onChange={(discount) => setValues({ ...values, discount })} isDisabled={pending} />
      </div>
      <Input label="Reason for the change" value={values.reason} onChange={(reason) => setValues({ ...values, reason })} isDisabled={pending} hint="Kept in the change history" />
      {problem ? <p role="alert" className="text-body-regular text-text-error-primary">{problem}</p> : null}
      <div className="flex flex-wrap gap-3"><Button type="button" onClick={save} disabled={pending}>Save fee</Button><Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button></div>
    </>}
  </div>;
}
