import { parentContext } from "./scope";
import { progressFor } from "@/lib/fixtures/progress";
import { refundFor } from "@/lib/fixtures/views";
import { today } from "@/lib/clock";
import type { ProtoState } from "@/lib/fixtures/state";

export function progressAsOf(state: ProtoState, code: string, date: string) {
  const refund = refundFor(state, code, date);
  const left = refund.status === "approved" || refund.status === "paid" ? refund.input.withdrawalDate : null;
  return progressFor(code, left && left < date ? left : date);
}

export async function getProgress(studentId?: string) {
  const { state, student } = await parentContext(studentId);
  return progressAsOf(state, student.code, await today());
}
