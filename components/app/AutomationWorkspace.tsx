"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseDate } from "@internationalized/date";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/application/data-table/data-table";
import { Tabs, TabList, Tab, TabPanel } from "@/components/base/tabs/tabs";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { Drawer, DrawerHeader, DrawerBody } from "@/components/base/drawer/drawer";
import { ComboBox, ComboBoxItem } from "@/components/base/combobox/combobox";
import { Select, SelectItem } from "@/components/base/select/select";
import { Textarea } from "@/components/base/textarea/textarea";
import { DatePicker } from "@/components/base/date-picker/date-picker";
import { Button } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { Chip } from "@/components/base/badges/chip";
import { AlertDialog } from "@/components/base/modal/modal";
import { toast } from "@/components/base/toast/toast";
import { resolveUnmatched } from "@/lib/actions/payments";
import { setDemoDate, runRemindersNow, resetDemo } from "@/lib/actions/demo";
import { inr, dateLabel } from "@/lib/format";
import type { AutomationVM, ReminderRow } from "@/lib/types";
import { EmptyState } from "./EmptyState";

type QueueItem = AutomationVM["unmatched"][number];
type Candidate = { code: string; name: string; instalments: { id: string; balance: number; seq: number }[] };
type ListedReminder = ReminderRow & { id: string };

export function AutomationWorkspace({ view, candidates, tab, initialItem, initialFilter = "upcoming" }: { view: AutomationVM; candidates: Candidate[]; tab: "reminders" | "unmatched"; initialItem?: string; initialFilter?: "upcoming" | "needsCall" }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"sent" | "upcoming" | "stopped" | "needsCall">(initialFilter);
  const [message, setMessage] = useState<ReminderRow | null>(null);
  const [queueId, setQueueId] = useState<string | null>(initialItem ?? null);
  const [student, setStudent] = useState("");
  const [search, setSearch] = useState("");
  const [instalment, setInstalment] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [resetOpen, setResetOpen] = useState(false);
  const [beforeRun, setBeforeRun] = useState<Set<string> | null>(null);
  const queue = view.unmatched.find((item) => item.id === queueId) ?? null;
  const selected = candidates.find((item) => item.code === student);
  function openQueue(item: QueueItem) {
    setQueueId(item.id); setStudent(item.suggested?.studentCode ?? ""); setSearch(item.suggested?.studentName ?? ""); setInstalment(item.suggested?.instalmentId ?? ""); setNote(""); setError("");
  }
  async function resolve(action: "match" | "reject") {
    setError("");
    if (action === "reject" && !note.trim()) { setError("Enter a reason before rejecting this payment."); return; }
    if (action === "match" && !instalment) { setError("Choose a student and instalment."); return; }
    startTransition(async () => { try { const result = await resolveUnmatched({ id: queue!.id, action, instalmentId: instalment || undefined, note }); if (!result.ok) { setError(result.message); return; } toast.success(action === "match" ? "Payment matched. Receipt created." : "Payment rejected"); setQueueId(null); router.refresh(); } catch { setError("Could not resolve this payment. Please try again."); } });
  }
  const reminders = view[filter].map((row, index) => ({ ...row, id: `${row.instalmentId}-${row.step}-${index}` }));
  const reminderColumns: ColumnDef<ListedReminder>[] = [
    { accessorKey: "studentName", header: "Student", cell: ({ row }) => <LinkButton variant="secondary" onClick={() => setMessage(row.original)}>{row.original.studentName}</LinkButton> },
    { accessorKey: "instalmentId", header: "Instalment", cell: ({ row }) => row.original.instalmentId.split("-").at(-1) },
    { accessorKey: "step", header: "Step", cell: ({ row }) => row.original.step ?? "—" },
    { accessorKey: "on", header: "Date", cell: ({ row }) => row.original.on ? dateLabel(row.original.on, "en", view.today) : "—" },
    { accessorKey: "language", header: "Language", cell: ({ row }) => row.original.language === "hi" ? "Hindi" : "English" },
    { accessorKey: "stoppedReason", header: "Status", cell: ({ row }) => row.original.stoppedReason ? <Chip color="neutral">Stopped: {row.original.stoppedReason}</Chip> : filter === "sent" ? "Sent" : "Scheduled" },
  ];
  const queueColumns: ColumnDef<QueueItem>[] = [
    { accessorKey: "receivedOn", header: "Received", cell: ({ row }) => <LinkButton variant="secondary" onClick={() => openQueue(row.original)}>{dateLabel(row.original.receivedOn, "en", view.today)}</LinkButton> },
    { accessorKey: "amount", header: "Amount", cell: ({ row }) => <span className="tabular-nums">{inr(row.original.amount)}</span> },
    { accessorKey: "reference", header: "Reference", cell: ({ row }) => row.original.reference ?? "—" },
    { accessorKey: "reason", header: "Reason", cell: ({ row }) => row.original.reason.replaceAll("_", " ") },
    { id: "student", header: "Suggested student", cell: ({ row }) => <LinkButton variant="secondary" onClick={() => openQueue(row.original)}>{row.original.suggested?.studentName ?? "Find student"}</LinkButton> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <Chip color={row.original.status === "open" ? "yellow" : "neutral"}>{row.original.status}</Chip> },
  ];
  return <>
    <header><h1 className="text-title-1-medium">Automation</h1><p className="mt-2 text-body-regular text-text-secondary">Reminders and payments that need a decision</p></header>
    {view.demo ? <section aria-label="Demo controls" className="flex flex-wrap items-center gap-4 rounded-2xl bg-background-secondary-default p-4"><span className="text-body-medium">Demo date</span><DatePicker aria-label="Demo date" value={parseDate(view.today)} isDisabled={pending} onChange={(value) => value && startTransition(async () => { try { const result = await setDemoDate({ date: value.toString() }); if (!result.ok) toast.error(result.message); else { toast.success("Demo date saved"); router.refresh(); } } catch { toast.error("Could not save the demo date"); } })} /><Button variant="secondary" disabled={pending} onClick={() => startTransition(async () => { try { setBeforeRun(new Set(view.sent.map((row) => `${row.instalmentId}:${row.step}:${row.on}`))); const result = await runRemindersNow(); if (!result.ok) toast.error(result.message); else { toast.success(`Sent ${result.sent}. Nothing else due.`); setFilter("sent"); router.refresh(); } } catch { toast.error("Could not run reminders"); } })}>Run today&apos;s reminders</Button><LinkButton variant="secondary" onClick={() => setResetOpen(true)}>Reset demo</LinkButton></section> : null}
    <Tabs selectedKey={tab} onSelectionChange={(key) => router.push(`/staff/automation?tab=${key}`)}><TabList aria-label="Automation views"><Tab id="reminders">Reminders</Tab><Tab id="unmatched" count={view.unmatchedOpen}>Unmatched payments</Tab></TabList>
      <TabPanel id="reminders"><div className="flex flex-col gap-6"><SegmentedControl aria-label="Reminder status" className="flex-wrap" selectedKeys={[filter]} onSelectionChange={(keys) => setFilter(String(Array.from(keys)[0]) as typeof filter)}>{[["sent", "Sent"], ["upcoming", "Upcoming"], ["stopped", "Stopped"], ["needsCall", "Needs a call"]].map(([id, label]) => <SegmentedControlItem id={id} key={id}>{label}</SegmentedControlItem>)}</SegmentedControl>{reminders.length ? <DataTable label="Reminders" data={reminders} columns={reminderColumns} rowClassName={(row) => filter === "sent" && beforeRun && !beforeRun.has(`${row.instalmentId}:${row.step}:${row.on}`) ? "reminder-new" : undefined} renderCard={(row) => <div className="flex flex-col gap-2"><LinkButton variant="secondary" onClick={() => setMessage(row)}>{row.studentName} · {row.studentCode}</LinkButton><p className="text-body-regular">Instalment {row.instalmentId.split("-").at(-1)} · Step {row.step ?? "—"} · {row.language === "hi" ? "Hindi" : "English"}</p><p className="text-body-regular">{row.stoppedReason ? `Stopped: ${row.stoppedReason}` : row.on ? dateLabel(row.on, "en", view.today) : "—"}</p></div>} /> : <EmptyState title="No reminders in this view" />}</div></TabPanel>
      <TabPanel id="unmatched">{view.unmatched.length ? <DataTable label="Unmatched payments" data={view.unmatched} columns={queueColumns} renderCard={(item) => <div className="flex flex-col gap-3"><LinkButton variant="secondary" onClick={() => openQueue(item)}>{item.suggested?.studentName ?? item.reference ?? "Find student"}</LinkButton><div className="flex justify-between"><span className="tabular-nums">{inr(item.amount)}</span><Chip color={item.status === "open" ? "yellow" : "neutral"}>{item.status}</Chip></div><p className="text-body-regular">{dateLabel(item.receivedOn, "en", view.today)} · {item.reason.replaceAll("_", " ")}</p></div>} /> : <EmptyState title="No payments need matching" />}</TabPanel>
    </Tabs>
    <Drawer isOpen={!!message} onOpenChange={(open) => !open && setMessage(null)} aria-label="Reminder details"><DrawerHeader title={message?.studentName ?? "Reminder"} /><DrawerBody><div className="flex flex-col gap-6"><p className="text-body-regular text-text-secondary">{message?.language === "hi" ? "Hindi" : "English"} · Step {message?.step ?? "—"}</p><p className="whitespace-pre-wrap text-body-regular">{message?.body ?? (message?.stoppedReason ? `Stopped: ${message.stoppedReason}` : "No reminder message is scheduled.")}</p><LinkButton href={`/staff/students/${message?.studentCode}`} variant="secondary">Open student ledger</LinkButton></div></DrawerBody></Drawer>
    <Drawer isOpen={!!queue} onOpenChange={(open) => !open && setQueueId(null)} aria-label="Match payment"><DrawerHeader title="Payment review" description={queue ? `${inr(queue.amount)} · ${queue.reason.replaceAll("_", " ")}` : undefined} /><DrawerBody>{queue ? <div className="flex flex-col gap-6"><p className="text-body-regular">Reference: {queue.reference ?? "Not supplied"}</p>{queue.status !== "open" ? <p className="text-body-regular">This item is {queue.status}.</p> : <>
      <ComboBox label="Find student" inputValue={search} onInputChange={setSearch} selectedKey={student || null} onSelectionChange={(key) => { setStudent(key ? String(key) : ""); setInstalment(""); }} allowsCustomValue={false}>{candidates.filter((item) => `${item.name} ${item.code}`.toLowerCase().includes(search.toLowerCase())).map((item) => <ComboBoxItem id={item.code} key={item.code} textValue={item.name}>{item.name} · {item.code}</ComboBoxItem>)}</ComboBox>
      {selected ? <Select label="Instalment" placeholder="Choose an instalment" selectedKey={instalment || null} onSelectionChange={(key) => setInstalment(String(key))}>{selected.instalments.map((item) => <SelectItem id={item.id} key={item.id}>Instalment {item.seq} · {inr(item.balance)}</SelectItem>)}</Select> : null}
      <Textarea label="Resolution note" value={note} onChange={setNote} maxLength={300} hint="Required when rejecting a payment." /><Button disabled={pending || !instalment} onClick={() => resolve("match")}>Match payment</Button><Button variant="secondary" disabled={pending} onClick={() => resolve("reject")}>Reject payment</Button>{error ? <p role="alert" className="text-body-regular text-text-error-primary">{error}</p> : null}
    </>}{queue.suggested ? <LinkButton href={`/staff/students/${queue.suggested.studentCode}`} variant="secondary">Open student ledger</LinkButton> : null}</div> : null}</DrawerBody></Drawer>
    <AlertDialog isOpen={resetOpen} onOpenChange={setResetOpen} title="Reset the demo?" description="This restores sample payments, reminders, refunds and the demo date in this browser." confirmLabel="Reset demo" onConfirm={async () => { const result = await resetDemo(); if (!result.ok) { toast.error(result.message); throw new Error("Reset failed"); } setResetOpen(false); toast.success("Demo restored"); router.refresh(); }} />
  </>;
}
