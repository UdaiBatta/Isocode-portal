import { readProto, requirePrototypeRole } from "@/lib/fixtures/state";
import { ledgerFor } from "@/lib/fixtures/views";
import { requireCentre } from "./scope";
import { today } from "@/lib/clock";

export async function getLedger(code: string) {
  const state = await readProto();
  requirePrototypeRole(state, "accounts");
  requireCentre(state, code);
  return ledgerFor(state, code, await today());
}
