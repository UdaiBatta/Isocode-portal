import { redirect } from "next/navigation";
import { StaffShell } from "@/components/app/StaffShell";
import { StudentLedger } from "@/components/app/StudentLedger";
import { EmptyState } from "@/components/app/EmptyState";
import { StaffRouteLoading } from "@/components/app/StaffRouteLoading";
import { getLedger } from "@/lib/data/ledger";
import { getStaffPageContext } from "@/lib/data/staff";
import { previewState, type SearchParams } from "@/lib/preview";

export default async function Ledger({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<SearchParams> }) {
  const state = previewState(await searchParams);
  const context = await getStaffPageContext();
  if (context.role && context.role !== "accounts") redirect("/staff/login");
  if (state === "loading") return <StaffRouteLoading />;
  if (state === "empty") return <StaffShell><EmptyState title="No fee plan for this student" /></StaffShell>;
  const { code } = await params;
  return <StaffShell><StudentLedger view={await getLedger(code)} today={context.today} /></StaffShell>;
}
