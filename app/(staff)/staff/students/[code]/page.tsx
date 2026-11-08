import { redirect } from "next/navigation";
import { StaffShell } from "@/components/app/StaffShell";
import { StudentLedger } from "@/components/app/StudentLedger";
import { getLedger, getStudentRecord } from "@/lib/data/ledger";
import { getStaffPageContext } from "@/lib/data/staff";

export default async function Ledger({ params }: { params: Promise<{ code: string }> }) {
  const context = await getStaffPageContext();
  if (context.role && context.role !== "accounts") redirect("/staff/login");
  const { code } = await params;
  const [view, record] = await Promise.all([getLedger(code), getStudentRecord(code)]);
  return <StaffShell><StudentLedger view={view} {...record} today={context.today} /></StaffShell>;
}
