import { cookies } from "next/headers";
import { readProto, requirePrototypeRole } from "@/lib/fixtures/state";
import { batchVMs, centreVMs, manageWorld, staffVMs, studentVMs } from "@/lib/fixtures/admin";
import { today } from "@/lib/clock";
import type { AdminBatchVM, AdminCentreVM, AdminStaffVM, AdminStudentVM, AdminDirectoryVM, AdminFilters, AdminListVM, ChangeFilters, ChangeVM, RecordState } from "@/lib/types";
import { backend } from "@/lib/backend";

const PAGE_SIZE = 25;

function query(filters: AdminFilters | ChangeFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") params.set(key, String(value));
  return params.size ? `?${params}` : "";
}

async function world() {
  if ((await cookies()).get("sid")?.value) throw new Error("Manage is not connected to Django yet.");
  const state = await readProto();
  requirePrototypeRole(state, "admin");
  return { state, world: manageWorld(state), today: await today() };
}

function page<T extends { state: RecordState }>(rows: T[], on: string, filters: AdminFilters): AdminListVM<T> {
  const counts = { active: rows.filter((row) => row.state === "active").length, archived: rows.filter((row) => row.state === "archived").length };
  const shown = rows.filter((row) => row.state === (filters.state ?? "active"));
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, filters.page ?? 1), pages);
  return { today: on, rows: shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE), page: current, pages, counts };
}

const matches = (text: string, q?: string) => !q?.trim() || text.toLowerCase().includes(q.trim().toLowerCase());

export async function getAdminStudents(filters: AdminFilters = {}) {
  if ((await cookies()).get("sid")?.value) return backend<AdminListVM<AdminStudentVM>>(`admin_students${query(filters)}`, "/staff/login");
  const { state, world: data, today: on } = await world();
  const rows = studentVMs(data, state, on).filter((row) => (!filters.centre || row.centreId === filters.centre) && (!filters.batch || row.batchId === filters.batch) && matches(`${row.name} ${row.code} ${row.guardian.phone}`, filters.q));
  return page(rows, on, filters);
}

export async function getAdminBatches(filters: AdminFilters = {}) {
  if ((await cookies()).get("sid")?.value) return backend<AdminListVM<AdminBatchVM>>(`admin_batches${query(filters)}`, "/staff/login");
  const { world: data, today: on } = await world();
  return page(batchVMs(data).filter((row) => (!filters.centre || row.centreId === filters.centre) && matches(`${row.name} ${row.centre}`, filters.q)), on, filters);
}

export async function getAdminCentres(filters: AdminFilters = {}) {
  if ((await cookies()).get("sid")?.value) return backend<AdminListVM<AdminCentreVM>>(`admin_centres${query(filters)}`, "/staff/login");
  const { world: data, today: on } = await world();
  return page(centreVMs(data).filter((row) => matches(`${row.name} ${row.code}`, filters.q)), on, filters);
}

export async function getAdminStaff(filters: AdminFilters = {}) {
  if ((await cookies()).get("sid")?.value) return backend<AdminListVM<AdminStaffVM>>(`admin_staff${query(filters)}`, "/staff/login");
  const { world: data, today: on } = await world();
  return page(staffVMs(data).filter((row) => (!filters.centre || row.centreId === filters.centre) && matches(`${row.fullName} ${row.email}`, filters.q)), on, filters);
}

// Active centres and batches only: archived ones cannot take new students or staff.
export async function getAdminDirectory(): Promise<AdminDirectoryVM> {
  if ((await cookies()).get("sid")?.value) return backend<AdminDirectoryVM>("admin_directory", "/staff/login");
  const { world: data } = await world();
  return {
    centres: data.centres.filter((row) => row.state === "active").map((row) => ({ id: row.id, name: String(row.name) })),
    batches: data.batches.filter((row) => row.state === "active").map((row) => ({ id: row.id, name: String(row.name), centreId: String(row.centreId) })),
  };
}

export async function getChangeHistory(filters: ChangeFilters = {}): Promise<{ today: string; rows: ChangeVM[]; page: number; pages: number }> {
  if ((await cookies()).get("sid")?.value) return backend<{ today: string; rows: ChangeVM[]; page: number; pages: number }>(`admin_history${query(filters)}`, "/staff/login");
  const { world: data, today: on } = await world();
  const rows = data.history.filter((row) => (!filters.entity || row.entity === filters.entity) && (!filters.id || row.entityId === filters.id));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, filters.page ?? 1), pages);
  return { today: on, rows: rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE), page: current, pages };
}
