import { readProto, requirePrototypeRole } from "@/lib/fixtures/state";
import { centres, batches, students } from "@/lib/fixtures/catalog";

export async function getStaffDirectory() {
  const state = await readProto();
  requirePrototypeRole(state, "accounts");
  return {
    centres: centres.filter((item) => !state.centreId || item.id === state.centreId),
    batches: batches.filter((item) => !state.centreId || item.centreId === state.centreId),
    students: students.filter((item) => !state.centreId || (item.centreId ?? "MLV") === state.centreId).map((item) => ({ code: item.code, name: item.name, centreId: item.centreId ?? "MLV", batchId: batches.find((batch) => batch.centreId === (item.centreId ?? "MLV") && batch.name === item.batch)?.id })),
  };
}
