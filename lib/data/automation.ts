import { readProto, requirePrototypeRole } from "@/lib/fixtures/state";
import { automationFor } from "@/lib/fixtures/views";
import { today } from "@/lib/clock";

export async function getAutomation() {
  const state = await readProto();
  requirePrototypeRole(state, "accounts");
  if (state.centreId && state.centreId !== "MLV") return { today: await today(), demo: true, unmatchedOpen: 0, sent: [], upcoming: [], stopped: [], needsCall: [], unmatched: [] };
  return automationFor(state, await today());
}
