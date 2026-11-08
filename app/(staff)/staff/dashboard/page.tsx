import { redirect } from "next/navigation";
import { StaffShell } from "@/components/app/StaffShell";
import { DuesDashboard } from "@/components/app/DuesDashboard";
import { getDashboard } from "@/lib/data/dashboard";
import { getStaffDirectory } from "@/lib/data/staff";
import { getAutomationCounts } from "@/lib/data/automation";
import { getStudents } from "@/lib/data/students";
import { getAuthState } from "@/lib/data/auth";
import type { SearchParams } from "@/lib/types";

export default async function Dashboard({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const auth = await getAuthState();
  if (auth.role && auth.role !== "accounts") redirect("/staff/login");
  const filters = { group: query.group === "batch" ? "batch" as const : "centre" as const, centre: typeof query.centre === "string" ? query.centre : undefined, batch: typeof query.batch === "string" ? query.batch : undefined, };
  const [view, { centres }, automation, roster] = await Promise.all([getDashboard(filters), getStaffDirectory(), getAutomationCounts(), getStudents({ centre: filters.centre })]);
  const attention = [
    { label: "Payments to check", count: automation.unmatchedOpen, href: "/staff/automation?tab=unmatched" },
    { label: "Parents to call", count: automation.needsCall, href: "/staff/automation?filter=needsCall" },
    { label: "Students over 60 days late", count: roster.counts.over60, href: "/staff/students?status=over60" },
  ];
  return <StaffShell><DuesDashboard view={view} directory={{ centres }} filters={filters} attention={attention} /></StaffShell>;
}
