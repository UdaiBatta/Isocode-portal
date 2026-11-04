import { readProto, requirePrototypeRole } from "@/lib/fixtures/state";
import { studentsFor } from "@/lib/fixtures/views";
import { today } from "@/lib/clock";
import type { StudentFilters } from "@/lib/types";

export async function getStudents(filters: StudentFilters = {}) {
  const state = await readProto();
  requirePrototypeRole(state, "accounts");
  return studentsFor(state, await today(), filters);
}
