import { backend } from "@/lib/backend";
import type { DashboardVM } from "@/lib/types";
export async function getDashboard(filters: { group?: "centre" | "batch"; centre?: string; batch?: string } = {}) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== undefined));
  return backend<DashboardVM>(`dashboard?${query}`, "/staff/login");
}
