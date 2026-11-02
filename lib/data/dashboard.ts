import { readProto, requirePrototypeRole } from "@/lib/fixtures/state";
import { dashboardFor } from "@/lib/fixtures/views";
import { today } from "@/lib/clock";

export async function getDashboard(filters: { group?: "centre" | "batch"; centre?: string; batch?: string } = {}) {
  const state = await readProto();
  requirePrototypeRole(state, "accounts");
  return dashboardFor(state, await today(), filters);
}
