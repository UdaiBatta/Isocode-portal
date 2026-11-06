"use server";

import { z } from "zod";
import { codeSchema, dateSchema, mutateProto, fail } from "@/lib/fixtures/state";
import { refundFor } from "@/lib/fixtures/views";
import { refundSnapshots } from "@/lib/fixtures/operations";
import { requireCentre } from "@/lib/data/scope";
import { today } from "@/lib/clock";
import { cookies } from "next/headers";
import { backendResponse, backendResult } from "@/lib/backend";
import type { RefundVM } from "@/lib/types";

export async function previewRefund(input: unknown) {
  const parsed = z.object({ studentId: codeSchema, withdrawalDate: dateSchema }).safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "invalid", message: "Choose a student and withdrawal date." };
  if ((await cookies()).get("sid")?.value) {
    const { studentId, withdrawalDate } = parsed.data;
    return backendResult<RefundVM>(await backendResponse(`refund?student=${encodeURIComponent(studentId)}&withdrawalDate=${encodeURIComponent(withdrawalDate)}`));
  }
  return { ok: false as const, code: "demo_date", message: "Use the supplied date for this prototype refund example." };
}

export async function saveRefundDraft(input: unknown) {
  if ((await cookies()).get("sid")?.value) {
    return backendResult<{ refundId: string }>(await backendResponse("save_refund_draft", input));
  }
  return mutateProto("accounts", async (state) => {
    const value = z.object({ studentId: codeSchema, withdrawalDate: dateSchema, reason: z.enum(["Personal", "Moved city", "Changed course", "Health", "Other"]) }).parse(input);
    const student = requireCentre(state, value.studentId);
    const snapshot = refundSnapshots[student.code];
    const view = refundFor(state, student.code, await today());
    if (view.status === "approved" || view.status === "paid") fail("read_only", "Approved refunds are read-only.");
    if (value.withdrawalDate > await today() || value.withdrawalDate < student.enrolledOn) fail("invalid_date", "Choose a date between enrolment and today.");
    // shortcut: prototype refunds use supplied snapshots, replace with Django's tested calculator after Gate 0. LIMIT: supported snapshot dates only.
    if (!snapshot || snapshot.date !== value.withdrawalDate) fail("demo_date", "Use the prefilled date for this prototype refund example.");
    (state.refunds ??= {})[student.code] = { withdrawalDate: value.withdrawalDate, reason: value.reason, status: "draft" };
    return { refundId: student.code };
  });
}

export async function approveRefund(input: unknown) {
  if ((await cookies()).get("sid")?.value) {
    return backendResult<{ refundId: string }>(await backendResponse("approve_refund", input));
  }
  return mutateProto("accounts", async (state) => {
    const { refundId } = z.object({ refundId: codeSchema }).parse(input);
    requireCentre(state, refundId);
    const view = refundFor(state, refundId, await today());
    if (view.status !== "draft") fail("not_draft", "Save a draft before approving the refund.");
    if (view.blockedBy) fail("unmatched", "Resolve the open payment before approving this refund.");
    if (!view.calc || !view.input.withdrawalDate) fail("no_plan", "No refund snapshot is available.");
    (state.refunds ??= {})[refundId] = { withdrawalDate: view.input.withdrawalDate, reason: state.refunds?.[refundId]?.reason ?? "Personal", status: "approved" };
    return { refundId };
  });
}

export async function markRefundPaid(input: unknown) {
  if ((await cookies()).get("sid")?.value) {
    return backendResult<{ refundId: string; paidOn: string }>(await backendResponse("mark_refund_paid", input));
  }
  return mutateProto("accounts", async (state) => {
    const { refundId } = z.object({ refundId: codeSchema }).parse(input);
    requireCentre(state, refundId);
    const view = refundFor(state, refundId, await today());
    if (view.status !== "approved" || !view.input.withdrawalDate) fail("not_approved", "Only approved refunds can be marked paid.");
    (state.refunds ??= {})[refundId] = { withdrawalDate: view.input.withdrawalDate, reason: state.refunds?.[refundId]?.reason ?? "Personal", status: "paid" };
    return { refundId, paidOn: await today() };
  });
}
