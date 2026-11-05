import { cookies } from "next/headers";
import { backend } from "@/lib/backend";
import { parentContext } from "./scope";
import { duesFor } from "@/lib/fixtures/views";
import { today } from "@/lib/clock";
import type { DuesVM } from "@/lib/types";

export async function getDues(studentId?: string) {
  if ((await cookies()).get("sid")?.value) {
    return backend<DuesVM>(`dues${studentId ? `?student=${encodeURIComponent(studentId)}` : ""}`);
  }
  const { state, student } = await parentContext(studentId);
  return duesFor(state, student.code, await today());
}
