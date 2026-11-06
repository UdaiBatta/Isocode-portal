import { readProto, requirePrototypeRole } from "@/lib/fixtures/state";
import { dashboardFor } from "@/lib/fixtures/views";
import { today } from "@/lib/clock";
import { cookies } from "next/headers";
import { backend } from "@/lib/backend";
import type { DashboardVM } from "@/lib/types";

export async function getDashboard(filters: { group?: "centre" | "batch"; centre?: string; batch?: string } = {}) {
  if ((await cookies()).get("sid")?.value) {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== undefined));
    return backend<DashboardVM>(`dashboard?${query}`, "/staff/login");
  }
  const state = await readProto();
  requirePrototypeRole(state, "accounts");
  return dashboardFor(state, await today(), filters);
}
