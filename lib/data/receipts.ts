import { readProto, fail, requirePrototypeRole } from "@/lib/fixtures/state";
import { queueFor, receiptsFor } from "@/lib/fixtures/views";
import { students } from "@/lib/fixtures/catalog";
import { parentContext, requireCentre } from "./scope";
import { ORG } from "@/lib/config";

export async function getReceiptOrganisation() { return ORG; }

export async function getReceipts(studentId?: string) {
  const { state, student } = await parentContext(studentId);
  return receiptsFor(state, student.code);
}

export interface InvoiceRow { id: string; number: string; issuedOn: string; amount: number; method: string | null; status: "paid" | "pending"; href: string | null }

export async function getInvoices(studentId?: string): Promise<InvoiceRow[]> {
  const { state, student } = await parentContext(studentId);
  const paid: InvoiceRow[] = receiptsFor(state, student.code).map((receipt) => ({ id: receipt.id, number: receipt.number, issuedOn: receipt.issuedOn, amount: receipt.amount, method: receipt.method, status: "paid", href: `/receipts/${receipt.id}` }));
  const pending: InvoiceRow[] = queueFor(state).filter((item) => item.status === "open" && item.suggested?.studentCode === student.code).map((item) => ({ id: item.id, number: item.reference ?? "—", issuedOn: item.receivedOn, amount: item.amount, method: null, status: "pending", href: null }));
  return [...paid, ...pending].sort((a, b) => b.issuedOn.localeCompare(a.issuedOn));
}

export async function getReceipt(id: string) {
  const state = await readProto();
  if (state.role === "counsellor") fail("forbidden", "Receipt not found.");
  for (const student of students) {
    const receipt = receiptsFor(state, student.code).find((item) => item.id === id);
    if (!receipt) continue;
    if (state.role === "accounts") { requirePrototypeRole(state, "accounts"); requireCentre(state, student.code); }
    else await parentContext(student.code);
    return receipt;
  }
  fail("not_found", "Receipt not found.");
}
