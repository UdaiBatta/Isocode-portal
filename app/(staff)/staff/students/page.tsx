import { redirect } from "next/navigation";
import { StaffShell } from "@/components/app/StaffShell";
import { StudentRoster } from "@/components/app/StudentRoster";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { getStudents } from "@/lib/data/students";
import { getStaffDirectory } from "@/lib/data/staff";
import { getAuthState } from "@/lib/data/auth";
import { previewState, type SearchParams } from "@/lib/preview";
import type { StudentFilters } from "@/lib/types";

const statuses = ["overdue", "over60", "upcoming", "clear", "checking", "withdrawn"] as const;
const text = (value: unknown) => typeof value === "string" && value ? value : undefined;

export default async function Students({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const state = previewState(query);
  if (state === "loading") return <StaffShell><PageSkeleton language="en" /></StaffShell>;
  const auth = await getAuthState();
  if (auth.role && auth.role !== "accounts") redirect("/staff/login");
  const filters: StudentFilters = { status: statuses.find((status) => status === query.status), centre: text(query.centre), batch: text(query.batch), q: text(query.q), page: Math.max(1, Number(query.page) || 1) };
  const [view, directory] = await Promise.all([getStudents(filters), getStaffDirectory()]);
  return <StaffShell><StudentRoster view={state === "empty" ? { ...view, rows: [], pages: 1 } : view} directory={directory} filters={filters} /></StaffShell>;
}
