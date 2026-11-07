import { redirect } from "next/navigation";
import { StaffShell } from "@/components/app/StaffShell";
import { StaffRouteLoading } from "@/components/app/StaffRouteLoading";
import { EmptyState } from "@/components/app/EmptyState";
import { ProgressUpload } from "@/components/app/ProgressUpload";
import { getStaffDirectory, getStaffPageContext } from "@/lib/data/staff";
import { previewState, type SearchParams } from "@/lib/preview";

export default async function Upload({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const state = previewState(await searchParams);
  const context = await getStaffPageContext();
  if (context.role !== "accounts") redirect("/staff/login");
  if (state === "loading") return <StaffRouteLoading />;
  const directory = await getStaffDirectory();
  const centre = (id: string) => directory.centres.find((item) => item.id === id)?.name ?? "";
  const batches = state === "empty" ? [] : directory.batches.map((batch) => ({ id: batch.id, label: `${centre(batch.centreId)} · ${batch.name}` }));
  return <StaffShell>{batches.length ? <ProgressUpload batches={batches} /> : <EmptyState title="No batches to upload results for" />}</StaffShell>;
}
