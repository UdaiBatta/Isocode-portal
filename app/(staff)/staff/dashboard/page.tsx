import { redirect } from "next/navigation";
import { StaffShell } from "@/components/app/StaffShell";
import { DuesDashboard } from "@/components/app/DuesDashboard";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { getDashboard } from "@/lib/data/dashboard";
import { getStaffDirectory } from "@/lib/data/staff";
import { getAutomation } from "@/lib/data/automation";
import { getStudents } from "@/lib/data/students";
import { getAuthState } from "@/lib/data/auth";
import { previewState, type SearchParams } from "@/lib/preview";

export default async function Dashboard({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const state = previewState(query);
  if (state === "loading") return <StaffShell><PageSkeleton language="en" /></StaffShell>;
  const auth = await getAuthState();
  if (auth.role && auth.role !== "accounts") redirect("/staff/login");
  const filters = { group: query.group === "batch" ? "batch" as const : "centre" as const, centre: typeof query.centre === "string" ? query.centre : undefined, batch: typeof query.batch === "string" ? query.batch : undefined, };
  const [view, directory, automation, roster] = await Promise.all([getDashboard(filters), getStaffDirectory(), getAutomation(), getStudents({ centre: filters.centre })]);
  const attention = [
    { label: "Payments to check", count: automation.unmatchedOpen, href: "/staff/automation?tab=unmatched" },
    { label: "Parents to call", count: automation.needsCall.length, href: "/staff/automation?filter=needsCall" },
    { label: "Students over 60 days late", count: roster.counts.over60, href: "/staff/students?status=over60" },
  ];
  return <StaffShell><DuesDashboard view={state === "empty" ? { ...view, rows: [], students: [], totals: { outstanding: 0, overdue: 0, over60Pct: 0, refundsDue: 0, refundsLate: 0 } } : view} directory={directory} filters={filters} attention={state === "empty" ? [] : attention} /></StaffShell>;
}
