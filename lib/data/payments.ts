import { readPreviewState } from "@/lib/fixtures/state";
import { ledgerFor, studentFor, receiptsFor } from "@/lib/fixtures/views";
import { today } from "@/lib/clock";
import { getAuthState } from "@/lib/data/auth";

export async function getPayDetails(token: string) {
  if (!/^STU-\d{4}-[1-4]$/.test(token)) return null;
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
  const state = await readPreviewState();
  if (typeof eventId !== "string") return null;
  const event = state.paymentResults?.[eventId];
  if (!event || event.token !== token) return null;
  const student = studentFor(token.slice(0, 8));
  const receipt = event.receiptId ? receiptsFor(state, student.code).find((item) => item.id === event.receiptId) : null;
  const auth = await getAuthState();
  const parentCanAccess = auth.role === "parent" && auth.consent === true && auth.phone === student.phone;
  const staffCanAccess = auth.role === "accounts" && (!auth.centreId || auth.centreId === (student.centreId ?? "MLV"));
  const reference = event.on ? `TXN-${event.on.replaceAll("-", "")}-${eventId.split("-").at(-1)!.padStart(4, "0")}` : null;
  return { ...event, firstName: student.name.split(" ")[0], seq: Number(token.at(-1)), reference, receiptNumber: receipt?.number ?? null, parentCanAccess, canViewReceipt: parentCanAccess || staffCanAccess };
}
