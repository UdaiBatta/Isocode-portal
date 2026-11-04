"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseDate } from "@internationalized/date";
import { Breadcrumb, BreadcrumbItem } from "@/components/base/breadcrumb/breadcrumb";
import { DatePicker } from "@/components/base/date-picker/date-picker";
import { Select, SelectItem } from "@/components/base/select/select";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@/components/base/table/table";
import { Button } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { AlertDialog } from "@/components/base/modal/modal";
import { Notification } from "@/components/base/notification/notification";
import { toast } from "@/components/base/toast/toast";
import { saveRefundDraft, approveRefund, markRefundPaid } from "@/lib/actions/refund";
import { dateLabel, inr } from "@/lib/format";
import type { LedgerVM, RefundVM } from "@/lib/types";
import { StatusChip } from "./StatusChip";
import { EmptyState } from "./EmptyState";
import { StaffFrame, StaffPageHeader } from "./StaffPage";

export function RefundCalculator({ view, plan, today }: { view: RefundVM; plan: LedgerVM["plan"]; today: string }) {
  const router = useRouter();
  const [date, setDate] = useState(view.input.withdrawalDate ? parseDate(view.input.withdrawalDate) : null);
  const [reason, setReason] = useState(view.input.reason ?? "");
  const [confirm, setConfirm] = useState<"approve" | "paid" | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [dateChanged, setDateChanged] = useState(false);
  const frozen = view.status === "approved" || view.status === "paid";
  const supported = date?.toString() === view.input.withdrawalDate;
  const calc = supported ? view.calc : null;
  async function perform(action: "save" | "approve" | "paid") {
    setError("");
    if (!date || date.toString() > today) { setError("Choose a withdrawal date on or before today."); return false; }
    if (!reason) { setError("Choose a reason."); return false; }
    try {
      const result = action === "save" ? await saveRefundDraft({ studentId: view.student.code, withdrawalDate: date.toString(), reason }) : action === "approve" ? await approveRefund({ refundId: view.student.code }) : await markRefundPaid({ refundId: view.student.code });
      if (!result.ok) { setError(result.message); return false; }
      toast.success(action === "save" ? "Refund draft saved" : action === "approve" ? "Refund approved. Reminders stopped." : "Refund marked as paid");
      router.refresh(); return true;
    } catch { setError("Could not save the refund. Please try again."); return false; }
  }
  const calculation: [string, string][] = calc ? [
    ["Net fee", inr(plan.net)], ["Session days", String(calc.totalDays)], ["Days used (inclusive)", String(calc.elapsedDays)],
    ["Fee for days used", inr(calc.earned)], ["Paid so far", inr(plan.paid)],
    [calc.stillPayable ? "Still payable" : "Refund", inr(calc.stillPayable || calc.refund)],
    ["Taxable value", inr(calc.taxable)], ["CGST 9%", inr(calc.cgst)], ["SGST 9%", inr(calc.sgst)], ["Pay by", dateLabel(calc.deadline, "en", today)],
  ] : [];
  return <>
    <Breadcrumb><BreadcrumbItem href="/staff/dashboard">Dashboard</BreadcrumbItem><BreadcrumbItem href={`/staff/students/${view.student.code}`}>{view.student.name}</BreadcrumbItem><BreadcrumbItem current>Refund</BreadcrumbItem></Breadcrumb>
    <StaffPageHeader title={`Refund · ${view.student.name}`} description={`Worked out from written policy ${view.policy.version}. Change the date to recalculate.`}>{view.status !== "new" ? <StatusChip status={view.status} /> : null}</StaffPageHeader>
    {!view.calc ? <EmptyState title="No fee plan available for refund" /> : <>
      {view.blockedBy ? <Notification title="Resolve the payment before approval" description={<span>{inr(view.blockedBy.amount)} is being checked. <LinkButton variant="secondary" href={`/staff/automation?tab=unmatched&item=${view.blockedBy.unmatchedId}`}>Open queue item</LinkButton></span>} status="information" dismissible={false} /> : null}
      {view.overdueDeadline ? <Notification title="Refund deadline has passed" description="Contact accounts to arrange payment." status="error" dismissible={false} /> : null}
      <StaffFrame><div className="grid items-start gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(300px,1.4fr)]">
        <section className="flex flex-col items-start gap-6 rounded-3xl border border-border-button-default bg-background-primary-default p-4 md:p-5"><div><p className="mb-2 text-body-medium">Withdrawal date</p><DatePicker aria-label="Withdrawal date" value={date} onChange={(value) => { setDate(value); setDateChanged(true); }} isDisabled={frozen} /></div>
          <Select label="Reason" selectedKey={reason || null} onSelectionChange={(key) => setReason(String(key))} isDisabled={frozen} placeholder="Choose a reason">{["Personal", "Moved city", "Changed course", "Health", "Other"].map((item) => <SelectItem id={item} key={item}>{item}</SelectItem>)}</Select>
          {!supported ? <p role="status" className="text-body-regular text-text-secondary">This prototype uses the supplied {view.input.withdrawalDate} calculation. Restore that date to continue.</p> : null}
          {frozen ? <p className="text-body-regular text-text-secondary">The approved calculation is frozen.</p> : <Button variant={view.status === "draft" ? "secondary" : "primary"} disabled={pending || !supported} onClick={() => startTransition(async () => { await perform("save"); })}>Save draft</Button>}
          {view.status === "draft" ? <Button disabled={pending || !!view.blockedBy || !supported || reason !== view.input.reason} onClick={() => setConfirm("approve")}>Approve refund</Button> : view.status === "approved" ? <Button onClick={() => setConfirm("paid")}>Mark as paid (mock)</Button> : null}
          {error ? <p role="alert" className="text-body-regular text-text-error-primary">{error}</p> : null}
          <LinkButton href="/refund-policy" variant="secondary">Refund policy</LinkButton>
        </section>
        <section className="flex min-w-0 flex-col gap-5 rounded-3xl border border-border-button-default bg-background-primary-default p-4 md:p-5"><h2 className="text-headline-medium">Refund Policy {view.policy.version}</h2>{calc ? <Table key={date?.toString()} aria-label="Refund calculation" size="md" className={dateChanged ? "refund-lines" : undefined}><TableHeader><TableColumn id="step" isRowHeader><span className="text-text-primary">Calculation</span></TableColumn><TableColumn id="value"><span className="text-text-primary">Value</span></TableColumn></TableHeader><TableBody>{calculation.map(([label, value]) => <TableRow id={label} key={label}><TableCell><span className="text-body-regular">{label}</span></TableCell><TableCell><span className="block text-end text-body-medium tabular-nums">{value}</span></TableCell></TableRow>)}</TableBody></Table> : <EmptyState title="Choose the supplied prototype date to see the calculation" />}</section>
      </div></StaffFrame>
    </>}
    <AlertDialog isOpen={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)} title={confirm === "approve" ? "Approve this refund?" : "Mark this refund as paid?"} description={confirm === "approve" ? "This freezes the calculation, withdraws the student and stops reminders." : "This records a mock refund payment."} confirmLabel={confirm === "approve" ? "Approve refund" : "Mark as paid"} variant="default" onConfirm={async () => { if (!await perform(confirm === "approve" ? "approve" : "paid")) throw new Error("Refund action failed"); setConfirm(null); }} />
  </>;
}
