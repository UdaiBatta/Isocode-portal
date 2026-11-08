import { redirect } from "next/navigation";
import { StaffShell } from "@/components/app/StaffShell";
import { EmptyState } from "@/components/app/EmptyState";
import { ProgressUpload } from "@/components/app/ProgressUpload";
import { getStaffDirectory, getStaffPageContext } from "@/lib/data/staff";

export default async function Upload() {
  const context = await getStaffPageContext();
  if (context.role !== "accounts") redirect("/staff/login");
  const directory = await getStaffDirectory();
  const centre = (id: string) => directory.centres.find((item) => item.id === id)?.name ?? "";
  const batches = directory.batches.map((batch) => ({ id: batch.id, label: `${centre(batch.centreId)} · ${batch.name}` }));
  return <StaffShell>{batches.length ? <ProgressUpload batches={batches} /> : <EmptyState title="No batches to upload results for" />}</StaffShell>;
}
