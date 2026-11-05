"use server";

import { readProto } from "@/lib/fixtures/state";
import { ledgerFor } from "@/lib/fixtures/views";
import { csv } from "@/lib/csv";
import { getStaffDirectory } from "@/lib/data/staff";
import { today } from "@/lib/clock";

export async function exportCsv(kind: "dues" | "receipts", filters: { centre?: string; batch?: string }) {
  const [directory, state, date] = await Promise.all([getStaffDirectory(), readProto(), today()]);
  const ledgers = directory.students.filter((student) => (!filters.centre || student.centreId === filters.centre) && (!filters.batch || student.batchId === filters.batch)).map((student) => ledgerFor(state, student.code, date));
  const rows = kind === "dues" ? [
    ["Student code", "Name", "Batch", "Centre", "Balance paise"],
    ...ledgers.filter((ledger) => ledger.student.status === "active" && ledger.plan.balance > 0).map((ledger) => [ledger.student.code, ledger.student.name, ledger.student.batch, ledger.student.centre, ledger.plan.balance]),
  ] : [
    ["Student code", "Date", "Receipt", "Method", "Amount paise"],
    ...ledgers.flatMap((ledger) => ledger.payments.filter((payment) => payment.on.slice(0, 7) === date.slice(0, 7)).map((payment) => [ledger.student.code, payment.on, payment.receiptId ?? "", payment.method, payment.amount])),
  ];
  return { filename: kind === "dues" ? `dues-${date}.csv` : `receipts-${date.slice(0, 7)}.csv`, text: csv(rows) };
}
