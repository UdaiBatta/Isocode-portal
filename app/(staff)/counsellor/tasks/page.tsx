import { redirect } from "next/navigation";
import { StaffShell } from "@/components/app/StaffShell";
import { CounsellorTasks } from "@/components/app/CounsellorTasks";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { getCounsellor } from "@/lib/data/counsellor";
import { getStaffPageContext } from "@/lib/data/staff";
import { previewState, type SearchParams } from "@/lib/preview";

export default async function Tasks({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const state = previewState(query);
  const context = await getStaffPageContext();
  if (context.role && context.role !== "counsellor") redirect("/staff/login");
  if (state === "loading") return <StaffShell counsellor><PageSkeleton language="en" /></StaffShell>;
  const view = await getCounsellor();
  return <StaffShell counsellor><CounsellorTasks view={state === "empty" ? { accuracy: { genuine: 0, total: 0 }, open: [], closed: [], watch: [], unknown: [] } : view} tab={query.tab === "watch" ? "watch" : query.tab === "unknown" ? "unknown" : "calls"} /></StaffShell>;
}
