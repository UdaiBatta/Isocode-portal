import { notFound, redirect } from "next/navigation";
import { StaffShell } from "@/components/app/StaffShell";
import { ManageHistory } from "@/components/app/ManageHistory";
import { ManageWorkspace, type ManageSection } from "@/components/app/ManageWorkspace";
import { getAdminBatches, getAdminCentres, getAdminDirectory, getAdminStaff, getAdminStudents, getChangeHistory } from "@/lib/data/admin";
import { getAuthState } from "@/lib/data/auth";
import type { SearchParams } from "@/lib/types";
import type { AdminFilters, ManageEntity } from "@/lib/types";

const loaders = { students: getAdminStudents, batches: getAdminBatches, centres: getAdminCentres, staff: getAdminStaff };
const text = (value: unknown) => typeof value === "string" && value ? value : undefined;
const page = (value: unknown) => Math.max(1, Number(value) || 1);

export default async function Manage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<SearchParams> }) {
  const [{ section }, query] = await Promise.all([params, searchParams]);
  if (section !== "history" && !Object.hasOwn(loaders, section)) notFound();
  const auth = await getAuthState();
  if (auth.role && auth.role !== "admin") redirect("/staff/login");
  if (section === "history") {
    const filters = { entity: (["student", "batch", "centre", "staff"] as const).find((item) => item === query.entity) as ManageEntity | undefined, id: text(query.id), page: page(query.page) };
    const view = await getChangeHistory(filters);
    return <StaffShell admin><ManageHistory view={view} filters={filters} /></StaffShell>;
  }
  const filters: AdminFilters = { q: text(query.q), centre: text(query.centre), batch: text(query.batch), state: query.state === "archived" ? "archived" : undefined, page: page(query.page) };
  const [view, directory] = await Promise.all([loaders[section as ManageSection](filters), getAdminDirectory()]);
  return <StaffShell admin><ManageWorkspace section={section as ManageSection} view={view as Parameters<typeof ManageWorkspace>[0]["view"]} directory={directory} filters={filters} /></StaffShell>;
}
