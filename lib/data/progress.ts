import { parentContext } from "./scope";
import { progressFor } from "@/lib/fixtures/progress";
import { refundFor } from "@/lib/fixtures/views";
import { today } from "@/lib/clock";

export async function getProgress(studentId?: string) {
  const { state, student } = await parentContext(studentId);
  const date = await today();
  const refund = refundFor(state, student.code, date);
  const left = refund.status === "approved" || refund.status === "paid" ? refund.input.withdrawalDate : null;
  return { studentName: student.name, ...progressFor(student.code, left && left < date ? left : date) };
}
