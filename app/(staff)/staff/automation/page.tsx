import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { StaffShell } from "@/components/app/StaffShell";
import { AutomationWorkspace } from "@/components/app/AutomationWorkspace";
import { getAutomationPage } from "@/lib/data/automation";
import { getStaffPageContext, getPaymentCandidates } from "@/lib/data/staff";
import type { SearchParams } from "@/lib/types";
import type { AutomationList } from "@/lib/types";

export default async function Automation({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const context = await getStaffPageContext();
  if (context.role && context.role !== "accounts") redirect("/staff/login");
  const tab = query.tab === "unmatched" || typeof query.item === "string" ? "unmatched" : "reminders";
  const validFilters = ["sent", "upcoming", "stopped", "needsCall"] as const;
  const filter = validFilters.includes(query.filter as typeof validFilters[number]) ? query.filter as typeof validFilters[number] : "upcoming";
  const list: AutomationList = tab === "unmatched" ? "unmatched" : filter;
  const page = typeof query.page === "string" && /^[1-9][0-9]*$/.test(query.page) ? Math.min(Number(query.page), 100000) : 1;
  const [view, candidates] = await Promise.all([
    getAutomationPage(list, page, typeof query.item === "string" ? query.item : undefined),
    getPaymentCandidates(),
  ]);
  return <StaffShell><AutomationWorkspace shared={Boolean((await cookies()).get("sid")?.value)} key={typeof query.item === "string" ? query.item : "no-item"} view={view} candidates={candidates} tab={tab} initialItem={typeof query.item === "string" ? query.item : undefined} initialFilter={filter} /></StaffShell>;
}
