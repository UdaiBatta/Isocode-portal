import { readPreviewState } from "@/lib/fixtures/state";
import { ledgerFor, studentFor, receiptsFor } from "@/lib/fixtures/views";
import { today } from "@/lib/clock";
import { getAuthState } from "@/lib/data/auth";
import { backendResponse, backendResult } from "@/lib/backend";

async function getRealPayDetails(token: string) {
  if (token.length > 256) return null;
  try {
    const response = await backendResponse(`pay_details?token=${encodeURIComponent(token)}`);
    const result = await backendResult<{ valid: boolean; firstName: string; seq: number; amount: number; dueDate: string; paid: boolean; payUrl: string | null }>(response);
    return result.ok && result.valid ? result : null;
  } catch { return null; }
}

export async function getPayDetails(token: string) {
  if (!/^STU-\d{4}-[1-4]$/.test(token)) return getRealPayDetails(token);
  try {
    const state = await readPreviewState();
    const code = token.slice(0, 8);
    const ledger = ledgerFor(state, code, await today());
    const instalment = ledger.instalments.find((item) => item.id === token);
    if (!instalment || ledger.student.status === "withdrawn") return null;
    return { firstName: studentFor(code).name.split(" ")[0], seq: instalment.seq, amount: instalment.balance, dueDate: instalment.dueDate, paid: instalment.balance === 0, payUrl: instalment.payUrl };
  } catch { return null; }
}

export async function getPaymentResult(token: string, eventId: unknown) {
  if (typeof eventId !== "string" || eventId.length > 200) return null;
  if (!/^STU-\d{4}-[1-4]$/.test(token)) {
    if (token.length > 256) return null;
    try {
      const response = await backendResponse(`payment_result?token=${encodeURIComponent(token)}&eventId=${encodeURIComponent(eventId)}`);
      const result = await backendResult<{ found: boolean; result: "paid" | "failed" | "checking"; receiptId: string | null; firstName: string; studentCode: string; seq: number; amount: number; method: string | null; on: string; reference: string; receiptNumber: string | null; parentCanAccess: boolean; canViewReceipt: boolean }>(response);
      return result.ok && result.found ? result : null;
    } catch { return null; }
  }
  const state = await readPreviewState();
  const event = state.paymentResults?.[eventId];
  if (!event || event.token !== token) return null;
  const student = studentFor(token.slice(0, 8));
  const receipt = event.receiptId ? receiptsFor(state, student.code).find((item) => item.id === event.receiptId) : null;
  const auth = await getAuthState();
  const parentCanAccess = auth.role === "parent" && auth.consent === true && auth.phone === student.phone;
  const staffCanAccess = auth.role === "accounts" && (!auth.centreId || auth.centreId === (student.centreId ?? "MLV"));
  const reference = event.on ? `TXN-${event.on.replaceAll("-", "")}-${eventId.split("-").at(-1)!.padStart(4, "0")}` : null;
  return { ...event, firstName: student.name.split(" ")[0], studentCode: student.code, seq: Number(token.at(-1)), reference, receiptNumber: receipt?.number ?? null, parentCanAccess, canViewReceipt: parentCanAccess || staffCanAccess };
}
