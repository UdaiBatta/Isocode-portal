import { redirect } from "next/navigation";
import { StaffShell } from "@/components/app/StaffShell";
import { AutomationWorkspace } from "@/components/app/AutomationWorkspace";
import { StaffRouteLoading } from "@/components/app/StaffRouteLoading";
import { getAutomation } from "@/lib/data/automation";
import { getStaffPageContext, getPaymentCandidates } from "@/lib/data/staff";
import { previewState, type SearchParams } from "@/lib/preview";

export default async function Automation({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const state = previewState(query);
  const context = await getStaffPageContext();
  if (context.role && context.role !== "accounts") redirect("/staff/login");
  if (state === "loading") return <StaffRouteLoading />;
  const [view, candidates] = await Promise.all([getAutomation(), getPaymentCandidates()]);
  return <StaffShell><AutomationWorkspace view={state === "empty" ? { ...view, sent: [], upcoming: [], stopped: [], needsCall: [], unmatched: [], unmatchedOpen: 0 } : view} candidates={candidates} tab={query.tab === "unmatched" ? "unmatched" : "reminders"} initialItem={typeof query.item === "string" ? query.item : undefined} initialFilter={query.filter === "needsCall" ? "needsCall" : undefined} /></StaffShell>;
}
