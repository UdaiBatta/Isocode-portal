import { readProto, requirePrototypeRole } from "@/lib/fixtures/state";
import { ledgerFor, studentFor } from "@/lib/fixtures/views";
import { cookies } from "next/headers";
import { backend } from "@/lib/backend";
import { progressAsOf } from "./progress";
import { studentInfoFor } from "./student";
import { requireCentre } from "./scope";
import { today } from "@/lib/clock";
import type { LedgerVM } from "@/lib/types";

export async function getLedger(code: string) {
  if ((await cookies()).get("sid")?.value) {
    return backend<LedgerVM>(`ledger?student=${encodeURIComponent(code)}`, "/staff/login");
  }
  const state = await readProto();
  requirePrototypeRole(state, "accounts");
  requireCentre(state, code);
  return ledgerFor(state, code, await today());
}

// The rest of a staff student record. Marks and attendance only: risk scores stay with counsellors.
export async function getStudentRecord(code: string) {
  const state = await readProto();
  requirePrototypeRole(state, "accounts");
  requireCentre(state, code);
  const date = await today();
  return { info: studentInfoFor(state, studentFor(code), date), progress: progressAsOf(state, code, date) };
}
