import { readProto, requirePrototypeRole } from "@/lib/fixtures/state";
import { counsellorFor } from "@/lib/fixtures/views";

export async function getCounsellor() {
  const state = await readProto();
  requirePrototypeRole(state, "counsellor");
  return counsellorFor(state);
}
