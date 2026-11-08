import { redirect } from "next/navigation";
import { StaffShell } from "@/components/app/StaffShell";
import { CounsellorTasks } from "@/components/app/CounsellorTasks";
import { getCounsellor } from "@/lib/data/counsellor";
import { getStaffPageContext } from "@/lib/data/staff";
import type { SearchParams } from "@/lib/types";

export default async function Tasks({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const context = await getStaffPageContext();
  if (context.role && context.role !== "counsellor") redirect("/staff/login");
  const view = await getCounsellor();
  return <StaffShell counsellor><CounsellorTasks view={view} tab={query.tab === "watch" ? "watch" : query.tab === "unknown" ? "unknown" : "calls"} /></StaffShell>;
}
