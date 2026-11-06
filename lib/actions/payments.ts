"use server";
import { z } from "zod";
import { createHmac, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { backendResponse, backendResult } from "@/lib/backend";
export async function submitMockPayment(input: unknown) {
  const parsed = z.object({ token: z.string().min(1).max(256), outcome: z.enum(["success", "failed", "wrong_amount"]), method: z.enum(["upi", "card", "netbanking"]).default("upi") }).safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "invalid", message: "Check the payment values." };
  const { token, outcome, method } = parsed.data;
  return submitRealMockPayment(token, outcome, method);
}
async function submitRealMockPayment(token: string, outcome: "success" | "failed" | "wrong_amount", method: "upi" | "card" | "netbanking") {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  const base = process.env.BACKEND_URL;
  if (!secret || !base) return { ok: false as const, code: "service_unavailable", message: "Payment service is not configured." };
  try {
    const detailsResponse = await backendResponse(`pay_details?token=${encodeURIComponent(token)}`);
    const details = await backendResult<{ valid: boolean; reference: string; amount: number; today: string; paid: boolean }>(detailsResponse);
    if (!details.ok) return details;
    if (!details.valid) return { ok: false as const, code: "invalid_link", message: "This payment link is not valid." };
    if (details.paid || details.amount <= 0) return { ok: false as const, code: "already_paid", message: "This instalment is already paid." };

    const payload = {
      event_id: randomUUID(), reference: details.reference,
      amount_paise: outcome === "wrong_amount" ? (details.amount > 100000 ? details.amount - 100000 : details.amount + 1) : details.amount,
      status: outcome === "failed" ? "failed" : "success", paid_on: details.today, method,
    };
    const body = JSON.stringify(payload);
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    const response = await fetch(`${base.replace(/\/$/, "")}/api/webhooks/payment`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Signature": signature },
      body, cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    const result = await backendResult<{ eventId: string; result: "allocated" | "queued" | "failed" | "pending" }>(response);
    if (!result.ok) return result;
    const paymentStatus = { allocated: "paid", queued: "checking", failed: "failed", pending: "checking" } as const;
    return {
      ok: true as const, eventId: result.eventId, receiptId: null,
      result: paymentStatus[result.result],
    };
  } catch {
    return { ok: false as const, code: "service_unavailable", message: "Payment could not be recorded. Try again." };
  }
}


export async function recordCounterPayment(input: unknown) {
  const parsed = z.object({ studentId: z.string().regex(/^STU-\d{4}$/), amountPaise: z.number().int().positive().safe(), method: z.enum(["cash", "cheque", "bank"]), receivedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), note: z.string().max(300).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "invalid", message: "Check the payment values." };
  const response = await backendResponse("counter_payment", { student: parsed.data.studentId, amount_paise: parsed.data.amountPaise, method: parsed.data.method, received_on: parsed.data.receivedOn, note: parsed.data.note ?? "" });
  if (response.status === 401) redirect("/staff/login");
  return backendResult<{ receiptId: string | null; receiptNumber: string | null; excess: number }>(response);
}
export async function resolveUnmatched(input: unknown) {
  const parsed = z.object({ id: z.string().uuid(), action: z.enum(["match", "reject"]), instalmentId: z.string().uuid().optional(), note: z.string().max(300).default("") }).safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "invalid", message: "Check the payment review details." };
  if (parsed.data.action === "match" && !parsed.data.instalmentId) return { ok: false as const, code: "invalid", message: "Choose a student and instalment." };
  if (parsed.data.action === "reject" && !parsed.data.note.trim()) return { ok: false as const, code: "note_required", message: "A rejection reason is required." };
  const response = await backendResponse("resolve_unmatched", parsed.data);
  if (response.status === 401) redirect("/staff/login");
  return backendResult<{ paymentId: string | null; receiptId: string | null; receiptNumber: string | null }>(response);
}
