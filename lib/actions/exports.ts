"use server";

import { getDashboard } from "@/lib/data/dashboard";
import { getLedger } from "@/lib/data/ledger";
import { csv } from "@/lib/csv";
import { getStaffDirectory } from "@/lib/data/staff";

export async function exportCsv(kind: "dues" | "receipts", filters: { centre?: string; batch?: string }) {
  const view = await getDashboard({ ...filters, group: "batch" });
  const directory = await getStaffDirectory();
  const ledgers = await Promise.all(directory.students.filter((student) => (!filters.centre || student.centreId === filters.centre) && (!filters.batch || student.batchId === filters.batch)).map((student) => getLedger(student.code)));
  const rows = kind === "dues" ? [
    ["Student code", "Name", "Batch", "Centre", "Balance paise"],
    ...ledgers.filter((ledger) => ledger.student.status === "active" && ledger.plan.balance > 0).map((ledger) => [ledger.student.code, ledger.student.name, ledger.student.batch, ledger.student.centre, ledger.plan.balance]),
  ] : [
    ["Student code", "Date", "Receipt", "Method", "Amount paise"],
    ...ledgers.flatMap((ledger) => ledger.payments.filter((payment) => payment.on.slice(0, 7) === view.today.slice(0, 7)).map((payment) => [ledger.student.code, payment.on, payment.receiptId ?? "", payment.method, payment.amount])),
  ];
  return { filename: kind === "dues" ? `dues-${view.today}.csv` : `receipts-${view.today.slice(0, 7)}.csv`, text: csv(rows) };
}
