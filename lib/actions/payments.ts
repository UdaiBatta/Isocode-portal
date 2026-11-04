"use server";

import { z } from "zod";
import { codeSchema, dateSchema, moneySchema, mutateProto, fail } from "@/lib/fixtures/state";
import { ledgerFor, queueFor, receiptsFor } from "@/lib/fixtures/views";
import { requireCentre } from "@/lib/data/scope";
import { today } from "@/lib/clock";

export async function submitMockPayment(input: unknown) {
  return mutateProto(null, async (state) => {
    const { token, outcome, method } = z.object({ token: z.string().regex(/^STU-\d{4}-[1-4]$/), outcome: z.enum(["success", "failed", "wrong_amount"]), method: z.enum(["upi", "card", "netbanking"]).default("upi") }).parse(input);
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
