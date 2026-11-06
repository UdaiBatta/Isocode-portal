"use server";
import { z } from "zod";
import { backendResponse, backendResult } from "@/lib/backend";
import type { RefundVM } from "@/lib/types";
export async function previewRefund(input: unknown) {
  const parsed = z.object({ studentId: z.string().regex(/^STU-\d{4}$/), withdrawalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "invalid", message: "Choose a student and withdrawal date." };
  const { studentId, withdrawalDate } = parsed.data;
  return backendResult<RefundVM>(await backendResponse(`refund?student=${encodeURIComponent(studentId)}&withdrawalDate=${encodeURIComponent(withdrawalDate)}`));
}
export async function saveRefundDraft(input: unknown) { return backendResult<{ refundId: string }>(await backendResponse("save_refund_draft", input)); }
export async function approveRefund(input: unknown) { return backendResult<{ refundId: string }>(await backendResponse("approve_refund", input)); }
export async function markRefundPaid(input: unknown) { return backendResult<{ refundId: string; paidOn: string }>(await backendResponse("mark_refund_paid", input)); }
