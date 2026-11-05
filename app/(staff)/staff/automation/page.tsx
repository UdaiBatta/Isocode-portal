import { redirect } from "next/navigation";
import { StaffShell } from "@/components/app/StaffShell";
import { AutomationWorkspace } from "@/components/app/AutomationWorkspace";
import { StaffRouteLoading } from "@/components/app/StaffRouteLoading";
import { getAutomationPage } from "@/lib/data/automation";
import { getStaffPageContext, getPaymentCandidates } from "@/lib/data/staff";
import { previewState, type SearchParams } from "@/lib/preview";
import type { AutomationList } from "@/lib/types";

export default async function Automation({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const state = previewState(query);
  const context = await getStaffPageContext();
  if (context.role && context.role !== "accounts") redirect("/staff/login");
  if (state === "loading") return <StaffRouteLoading />;
  const tab = query.tab === "unmatched" || typeof query.item === "string" ? "unmatched" : "reminders";
  const validFilters = ["sent", "upcoming", "stopped", "needsCall"] as const;
  const filter = validFilters.includes(query.filter as typeof validFilters[number]) ? query.filter as typeof validFilters[number] : "upcoming";
  const list: AutomationList = tab === "unmatched" ? "unmatched" : filter;
  const page = typeof query.page === "string" && /^[1-9][0-9]*$/.test(query.page) ? Math.min(Number(query.page), 100000) : 1;
  const [view, candidates] = await Promise.all([
    getAutomationPage(list, page, typeof query.item === "string" ? query.item : undefined),
    getPaymentCandidates(),
  ]);
  return <StaffShell><AutomationWorkspace key={typeof query.item === "string" ? query.item : "no-item"} view={state === "empty" ? { ...view, sent: [], upcoming: [], stopped: [], needsCall: [], unmatched: [], unmatchedOpen: 0, total: 0, totalPages: 1 } : view} candidates={candidates} tab={tab} initialItem={typeof query.item === "string" ? query.item : undefined} initialFilter={filter} /></StaffShell>;
}
