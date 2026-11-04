import { redirect } from "next/navigation";
import { StaffShell } from "@/components/app/StaffShell";
import { RefundCalculator } from "@/components/app/RefundCalculator";
import { EmptyState } from "@/components/app/EmptyState";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { getRefund } from "@/lib/data/refund";
import { getLedger } from "@/lib/data/ledger";
import { getStaffPageContext } from "@/lib/data/staff";
import { previewState, type SearchParams } from "@/lib/preview";

export default async function Refund({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<SearchParams> }) {
  const state = previewState(await searchParams);
  const context = await getStaffPageContext();
  if (context.role && context.role !== "accounts") redirect("/staff/login");
  if (state === "loading") return <StaffShell><PageSkeleton language="en" /></StaffShell>;
  if (state === "empty") return <StaffShell><EmptyState title="No fee plan available for refund" /></StaffShell>;
  const { code } = await params;
  const [view, ledger] = await Promise.all([getRefund(code), getLedger(code)]);
  return <StaffShell><RefundCalculator key={`${view.status}-${view.input.withdrawalDate}-${view.input.reason}`} view={view} plan={ledger.plan} today={context.today} /></StaffShell>;
}
