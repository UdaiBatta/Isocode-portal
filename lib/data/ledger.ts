import { readProto, requirePrototypeRole } from "@/lib/fixtures/state";
import { ledgerFor } from "@/lib/fixtures/views";
import { cookies } from "next/headers";
import { backend } from "@/lib/backend";
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
