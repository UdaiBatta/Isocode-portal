"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseDate } from "@internationalized/date";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/application/data-table/data-table";
import { Breadcrumb, BreadcrumbItem } from "@/components/base/breadcrumb/breadcrumb";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/buttons/button-group";
import { Button } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { Modal, ModalHeader, ModalBody } from "@/components/base/modal/modal";
import { NumberField } from "@/components/base/number-field/number-field";
import { Select, SelectItem } from "@/components/base/select/select";
import { DatePicker } from "@/components/base/date-picker/date-picker";
import { Textarea } from "@/components/base/textarea/textarea";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { toast } from "@/components/base/toast/toast";
import { recordCounterPayment } from "@/lib/actions/payments";
import { inr, dateLabel, rupeesToPaise } from "@/lib/format";
import { methodLabel } from "@/lib/i18n/checkout";
import type { InstalmentVM, LedgerVM } from "@/lib/types";
import { StatusChip } from "./StatusChip";
import { EmptyState } from "./EmptyState";

export function StudentLedger({ view, today }: { view: LedgerVM; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(parseDate(today));
  const [method, setMethod] = useState("cash");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const oldest = view.instalments.find((item) => item.balance > 0);
  const columns: ColumnDef<InstalmentVM>[] = [
    { accessorKey: "seq", header: "Instalment" },
    { accessorKey: "dueDate", header: "Due", cell: ({ row }) => dateLabel(row.original.dueDate, "en", today) },
    ...(["amount", "paid", "balance"] as const).map((key): ColumnDef<InstalmentVM> => ({ accessorKey: key, header: key[0].toUpperCase() + key.slice(1), cell: ({ row }) => <span className="block text-end tabular-nums">{inr(row.original[key])}</span> })),
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusChip status={row.original.partPaid ? "part_paid" : row.original.status} /> },
    { accessorKey: "daysOverdue", header: "Days overdue" },
  ];
  const payments: ColumnDef<LedgerVM["payments"][number]>[] = [
    { accessorKey: "on", header: "Date", cell: ({ row }) => dateLabel(row.original.on, "en", today) },
    { accessorKey: "method", header: "Method", cell: ({ row }) => methodLabel("en", row.original.method) },
    { accessorKey: "amount", header: "Amount", cell: ({ row }) => <span className="tabular-nums">{inr(row.original.amount)}</span> },
    { accessorKey: "receiptId", header: "Receipt", cell: ({ row }) => row.original.receiptId ? <LinkButton variant="secondary" href={`/receipts/${row.original.receiptId}`}>View receipt</LinkButton> : "—" },
  ];
  return <>
    <Breadcrumb><BreadcrumbItem href="/staff/dashboard">Dashboard</BreadcrumbItem><BreadcrumbItem current>{view.student.code}</BreadcrumbItem></Breadcrumb>
    <header className="flex flex-col gap-2"><h1 className="text-title-1-medium">{view.student.name}</h1><p className="text-body-regular text-text-secondary">{view.student.code} · {view.student.batch} · {view.student.centre} · {view.student.status === "withdrawn" ? "Withdrawn" : "Active"}</p></header>
    <dl className="grid grid-cols-2 gap-6 lg:grid-cols-4">{[["Net fee", inr(view.plan.net)], ["Paid", inr(view.plan.paid)], ["Balance", inr(view.plan.balance)], ["Days overdue", String(Math.max(0, ...view.instalments.map((item) => item.daysOverdue)))]].map(([label, value]) => <div key={label}><dt className="text-body-regular text-text-secondary">{label}</dt><dd className="mt-2 text-title-1-medium tabular-nums">{value}</dd></div>)}</dl>
    <ButtonGroup aria-label="Ledger actions" className="flex-wrap">
      <ButtonGroupItem disabled={view.student.status === "withdrawn"} onClick={() => setOpen(true)}>Record payment</ButtonGroupItem>
      <TooltipTrigger><ButtonGroupItem disabled={!oldest || view.student.status === "withdrawn"} onClick={async () => { try { await navigator.clipboard.writeText(new URL(`/pay/${oldest!.id}`, window.location.origin).href); toast.success("Pay link copied"); } catch { toast.error("Could not copy the pay link. Please try again."); } }}>Copy pay link</ButtonGroupItem><Tooltip>{oldest ? "Copy the oldest unpaid instalment link" : "There is nothing due"}</Tooltip></TooltipTrigger>
      <ButtonGroupItem onClick={() => router.push(`/staff/students/${view.student.code}/refund`)}>{view.refund ? "View refund" : "Start refund"}</ButtonGroupItem>
    </ButtonGroup>
    <section className="flex flex-col gap-4"><h2 className="text-headline-medium">Fee plan</h2><p className="text-body-regular">Gross {inr(view.plan.gross)} · Discount {inr(view.plan.discount)}{view.plan.discountReason ? ` (${view.plan.discountReason})` : ""} · Net {inr(view.plan.net)}</p></section>
    <section className="flex flex-col gap-4"><h2 className="text-headline-medium">Instalments</h2><DataTable label="Student instalments" data={view.instalments} columns={columns} renderCard={(item) => <div className="flex flex-col gap-3"><div className="flex justify-between gap-3"><span>Instalment {item.seq} · {dateLabel(item.dueDate, "en", today)}</span><StatusChip status={item.partPaid ? "part_paid" : item.status} /></div><p className="text-body-regular">Amount {inr(item.amount)} · Paid {inr(item.paid)}</p><p className="text-headline-medium tabular-nums">Balance {inr(item.balance)}</p><p className="text-body-2-regular">{item.daysOverdue} days overdue</p></div>} /></section>
    <section className="flex flex-col gap-4"><h2 className="text-headline-medium">Payments</h2>{view.payments.length ? <DataTable label="Student payments" data={view.payments} columns={payments} renderCard={(item) => <div className="flex flex-wrap justify-between gap-3"><span>{dateLabel(item.on, "en", today)} · {methodLabel("en", item.method)}</span><span className="tabular-nums">{inr(item.amount)}</span>{item.receiptId ? <LinkButton href={`/receipts/${item.receiptId}`} variant="secondary">View receipt</LinkButton> : null}</div>} /> : <EmptyState title="No payments recorded" />}</section>
    <section className="flex flex-col gap-4"><h2 className="text-headline-medium">Reminder timeline</h2><ol className="flex flex-col gap-5 border-s border-separator-border ps-5">{view.timeline.map((line) => <li key={line.instalmentId} className="flex flex-col gap-2"><h3 className="text-body-medium">Instalment {line.instalmentId.split("-").at(-1)}</h3>{line.sent.map((sent) => <p key={`${sent.step}-${sent.on}`} className="text-body-2-regular text-text-secondary">Sent {sent.step > 0 ? "+" : ""}{sent.step} · {dateLabel(sent.on, "en", today)} · {sent.language === "hi" ? "Hindi" : "English"}</p>)}{line.stopped ? <p className="text-body-medium">Stopped: {line.stopped}</p> : line.next ? <p className="text-body-medium">Next {line.next.step > 0 ? "+" : ""}{line.next.step} · {dateLabel(line.next.on, "en", today)}</p> : <p className="text-body-2-regular">No more steps</p>}</li>)}</ol></section>
    <Modal isOpen={open} onOpenChange={setOpen} aria-label="Record counter payment"><ModalHeader title="Record payment" description="The payment is allocated to the oldest unpaid instalment first." /><ModalBody><form className="flex flex-col gap-5" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget); setError("");
      let amount: number; try { amount = rupeesToPaise(String(form.get("amount"))); } catch (problem) { setError((problem as Error).message); return; }
      if (date.toString() > today) { setError("Payment date cannot be after today."); return; }
      startTransition(async () => { try { const result = await recordCounterPayment({ studentId: view.student.code, amountPaise: amount, method, receivedOn: date.toString(), note: String(form.get("note") ?? "") }); if (!result.ok) { setError(result.message); return; } toast.success(result.receiptNumber ? `Receipt ${result.receiptNumber} created` : "Payment recorded", { description: result.excess ? `${inr(result.excess)} sent to the unmatched queue.` : undefined }); setOpen(false); router.refresh(); } catch { setError("Could not record payment. Please try again."); } });
    }}><NumberField label="Amount in ₹" name="amount" minValue={0.01} step={0.01} formatOptions={{ useGrouping: false, maximumFractionDigits: 2 }} isRequired hideSteppers /><Select label="Method" selectedKey={method} onSelectionChange={(key) => setMethod(String(key))}>{["cash", "cheque", "bank"].map((item) => <SelectItem id={item} key={item}>{item === "bank" ? "Bank transfer" : item[0].toUpperCase() + item.slice(1)}</SelectItem>)}</Select><div><p className="mb-2 text-body-medium">Received on</p><DatePicker aria-label="Received on" value={date} onChange={(value) => value && setDate(value)} /></div><Textarea label="Note" name="note" maxLength={300} />{error ? <p role="alert" className="text-body-regular text-text-error-primary">{error}</p> : null}<Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save payment"}</Button></form></ModalBody></Modal>
  </>;
}
