import { backend } from "@/lib/backend";
import { ORG } from "@/lib/config";
import type { ReceiptSummaryVM, ReceiptVM } from "@/lib/types";
export async function getReceiptOrganisation() { return ORG; }
export async function getReceipts(studentId?: string): Promise<ReceiptSummaryVM[]> {
  return (await backend<{ receipts: ReceiptSummaryVM[] }>(`receipts${studentId ? `?student=${encodeURIComponent(studentId)}` : ""}`)).receipts;
}
export interface InvoiceRow { id: string; number: string; issuedOn: string; amount: number; method: string | null; status: "paid" | "pending"; href: string | null }
export async function getInvoices(studentId?: string): Promise<InvoiceRow[]> {
  return (await backend<{ invoices: InvoiceRow[] }>(`receipts${studentId ? `?student=${encodeURIComponent(studentId)}` : ""}`)).invoices;
}
export async function getReceipt(id: string): Promise<ReceiptVM> {
  return (await backend<{ receipt: ReceiptVM }>(`receipt?id=${encodeURIComponent(id)}`)).receipt;
}
