"use server";

import { z } from "zod";
import { createHmac, randomUUID } from "node:crypto";
import { codeSchema, dateSchema, moneySchema, mutateProto, mutatePublicPreview, fail } from "@/lib/fixtures/state";
import { ledgerFor, queueFor, receiptsFor } from "@/lib/fixtures/views";
import { requireCentre } from "@/lib/data/scope";
import { today } from "@/lib/clock";
import { backendResponse, backendResult } from "@/lib/backend";

export async function submitMockPayment(input: unknown) {
  const parsed = z.object({ token: z.string().min(1).max(256), outcome: z.enum(["success", "failed", "wrong_amount"]), method: z.enum(["upi", "card", "netbanking"]).default("upi") }).safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "invalid", message: "Check the payment values." };
  const { token, outcome, method } = parsed.data;
  if (!/^STU-\d{4}-[1-4]$/.test(token)) return submitRealMockPayment(token, outcome, method);
  return mutatePublicPreview(async (state) => {
    const code = token.slice(0, 8);
    requireCentre({}, code);
    const on = await today();
    const ledger = ledgerFor(state, code, on);
    const instalment = ledger.instalments.find((item) => item.id === token);
    if (!instalment || ledger.student.status === "withdrawn") fail("invalid_link", "This prototype link is not valid.");
    const finish = (result: "paid" | "failed" | "checking" | "already_paid", amount: number, receiptId: string | null = null) => {
      const events = state.paymentResults ??= {};
      const eventId = `demo-event-${Object.keys(events).length + 1}`;
      events[eventId] = { token, result, amount, receiptId, method, on };
      return { result, receiptId, eventId };
    };
    if (!instalment.balance) return finish("already_paid", instalment.amount);
    if (outcome === "failed") return finish("failed", instalment.balance);
    if (queueFor(state).some((item) => item.status === "open" && item.suggested?.instalmentId === token)) return finish("checking", instalment.balance);
    if (outcome === "wrong_amount") {
      const held = state.held ??= [];
      if (held.length >= 6) fail("demo_full", "Reset the demo before recording more activity.");
      held.push({ id: `held-${held.length + 1}`, amount: instalment.balance > 100000 ? instalment.balance - 100000 : instalment.balance + 1, on, instalmentId: token, reason: "amount_mismatch" });
      return finish("checking", held.at(-1)!.amount);
    }
    const payments = state.payments ??= [];
    payments.push({ studentCode: code, amount: instalment.balance, on, method, instalmentId: token });
    return finish("paid", instalment.balance, `demo-receipt-${payments.length}`);
  });
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
  return mutateProto("accounts", async (state) => {
    const value = z.object({ studentId: codeSchema, amountPaise: moneySchema.positive(), method: z.enum(["cash", "cheque", "bank"]), receivedOn: dateSchema, note: z.string().max(300).optional() }).parse(input);
    requireCentre(state, value.studentId);
    const on = await today();
    if (value.receivedOn > on) fail("invalid_date", "A payment cannot be recorded in the future.");
    const ledger = ledgerFor(state, value.studentId, on);
    if (ledger.student.status !== "active") fail("withdrawn", "This student has withdrawn.");
    const allocated = Math.min(ledger.plan.balance, value.amountPaise);
    let receiptId: string | null = null;
    if (allocated) {
      const payments = state.payments ??= [];
      payments.push({ studentCode: value.studentId, amount: allocated, on: value.receivedOn, method: value.method });
      receiptId = `demo-receipt-${payments.length}`;
    }
    const excess = value.amountPaise - allocated;
    if (excess) {
      const held = state.held ??= [];
      if (held.length >= 6) fail("demo_full", "Reset the demo before recording more activity.");
      held.push({ id: `held-${held.length + 1}`, amount: excess, on: value.receivedOn, reason: "excess_counter_payment" });
    }
    return { receiptId, receiptNumber: receiptId ? receiptsFor(state, value.studentId).find((receipt) => receipt.id === receiptId)?.number : null, excess };
  });
}

export async function resolveUnmatched(input: unknown) {
  return mutateProto("accounts", async (state) => {
    const value = z.object({ id: z.string().max(30), action: z.enum(["match", "reject"]), instalmentId: z.string().regex(/^STU-\d{4}-[1-4]$/).optional(), note: z.string().trim().max(300).default("") }).parse(input);
    const item = queueFor(state).find((row) => row.id === value.id);
    if (!item || item.status !== "open") fail("resolved", "This item has already been resolved.");
    if (item.suggested) requireCentre(state, item.suggested.studentCode);
    if (value.action === "reject" && !value.note) fail("note_required", "A rejection reason is required.");
    let receiptId: string | null = null;
    if (value.action === "match") {
      if (!value.instalmentId) fail("invalid", "Choose a student and instalment.");
      const code = value.instalmentId.slice(0, 8);
      requireCentre(state, code);
      const ledger = ledgerFor(state, code, await today());
      if (ledger.student.status !== "active") fail("withdrawn", "This student has withdrawn.");
      const start = ledger.instalments.findIndex((instalment) => instalment.id === value.instalmentId);
      if (start < 0 || item.amount > ledger.instalments.slice(start).reduce((sum, instalment) => sum + instalment.balance, 0)) fail("excess", "The payment exceeds the remaining balance.");
      const payments = state.payments ??= [];
      payments.push({ studentCode: code, amount: item.amount, on: item.receivedOn, method: "bank", instalmentId: value.instalmentId });
      receiptId = `demo-receipt-${payments.length}`;
    }
    (state.resolved ??= {})[item.id] = { action: value.action, note: value.note };
    return { receiptId };
  });
}
