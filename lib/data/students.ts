import { readProto, requirePrototypeRole } from "@/lib/fixtures/state";
import { studentsFor } from "@/lib/fixtures/views";
import { today } from "@/lib/clock";
import type { StudentFilters, StudentsVM } from "@/lib/types";
import { cookies } from "next/headers";
import { backend } from "@/lib/backend";

export async function getStudents(filters: StudentFilters = {}) {
  if ((await cookies()).get("sid")?.value) {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
    return backend<StudentsVM>(`students?${query}`, "/staff/login");
  }
  const state = await readProto();
  requirePrototypeRole(state, "accounts");
  return studentsFor(state, await today(), filters);
}
