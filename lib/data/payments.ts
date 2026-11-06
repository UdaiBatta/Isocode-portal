import { backendResponse, backendResult } from "@/lib/backend";

async function getRealPayDetails(token: string) {
  if (token.length > 256) return null;
  try {
    const response = await backendResponse(`pay_details?token=${encodeURIComponent(token)}`);
    const result = await backendResult<{ valid: boolean; firstName: string; seq: number; amount: number; dueDate: string; paid: boolean; payUrl: string | null }>(response);
    return result.ok && result.valid ? result : null;
  } catch { return null; }
}


export async function getPayDetails(token: string) { return getRealPayDetails(token); }

export async function getPaymentResult(token: string, eventId: unknown) {
  if (typeof eventId !== "string" || eventId.length > 200) return null;
    if (token.length > 256) return null;
    try {
      const response = await backendResponse(`payment_result?token=${encodeURIComponent(token)}&eventId=${encodeURIComponent(eventId)}`);
      const result = await backendResult<{ found: boolean; result: "paid" | "failed" | "checking"; receiptId: string | null; firstName: string; studentCode: string; seq: number; amount: number; method: string | null; on: string; reference: string; receiptNumber: string | null; parentCanAccess: boolean; canViewReceipt: boolean }>(response);
      return result.ok && result.found ? result : null;
    } catch { return null; }
}
