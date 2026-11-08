import { redirect } from "next/navigation";
import { StaffShell } from "@/components/app/StaffShell";
import { StudentRoster } from "@/components/app/StudentRoster";
import { getStudents } from "@/lib/data/students";
import { getStaffDirectory } from "@/lib/data/staff";
import { getAuthState } from "@/lib/data/auth";
import type { SearchParams } from "@/lib/types";
import type { StudentFilters } from "@/lib/types";

const statuses = ["overdue", "over60", "upcoming", "clear", "checking", "withdrawn"] as const;
const text = (value: unknown) => typeof value === "string" && value ? value : undefined;

export default async function Students({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const auth = await getAuthState();
  if (auth.role && auth.role !== "accounts") redirect("/staff/login");
  const filters: StudentFilters = { status: statuses.find((status) => status === query.status), centre: text(query.centre), batch: text(query.batch), q: text(query.q), page: Math.max(1, Number(query.page) || 1) };
  const [view, { centres, batches }] = await Promise.all([getStudents(filters), getStaffDirectory()]);
  // The dashboard's search opens the student directly when it finds exactly one.
  if (query.open === "1" && view.rows.length === 1 && view.pages === 1) redirect(`/staff/students/${view.rows[0].code}`);
  return <StaffShell><StudentRoster view={view} directory={{ centres, batches }} filters={filters} /></StaffShell>;
}
