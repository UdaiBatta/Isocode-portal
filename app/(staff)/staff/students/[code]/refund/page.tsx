import { redirect } from "next/navigation";
import { StaffShell } from "@/components/app/StaffShell";
import { RefundCalculator } from "@/components/app/RefundCalculator";
import { getRefund } from "@/lib/data/refund";
import { getLedger } from "@/lib/data/ledger";
import { getStaffPageContext } from "@/lib/data/staff";

export default async function Refund({ params }: { params: Promise<{ code: string }> }) {
  const context = await getStaffPageContext();
  if (context.role && context.role !== "accounts") redirect("/staff/login");
  const { code } = await params;
  const [view, ledger] = await Promise.all([getRefund(code), getLedger(code)]);
  return <StaffShell><RefundCalculator key={`${view.status}-${view.input.withdrawalDate}-${view.input.reason}`} view={view} plan={ledger.plan} today={context.today} /></StaffShell>;
}
