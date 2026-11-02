import { parentContext } from "./scope";
import { duesFor } from "@/lib/fixtures/views";
import { today } from "@/lib/clock";

export async function getDues(studentId?: string) {
  const { state, student } = await parentContext(studentId);
  return duesFor(state, student.code, await today());
}
