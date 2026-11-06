import { backend } from "@/lib/backend";
import type { AdminBatchVM, AdminCentreVM, AdminStaffVM, AdminStudentVM, AdminDirectoryVM, AdminFilters, AdminListVM, ChangeFilters, ChangeVM } from "@/lib/types";
function query(filters: AdminFilters | ChangeFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") params.set(key, String(value));
  return params.size ? `?${params}` : "";
}
export async function getAdminStudents(filters: AdminFilters = {}) { return backend<AdminListVM<AdminStudentVM>>(`admin_students${query(filters)}`, "/staff/login"); }
export async function getAdminBatches(filters: AdminFilters = {}) { return backend<AdminListVM<AdminBatchVM>>(`admin_batches${query(filters)}`, "/staff/login"); }
export async function getAdminCentres(filters: AdminFilters = {}) { return backend<AdminListVM<AdminCentreVM>>(`admin_centres${query(filters)}`, "/staff/login"); }
export async function getAdminStaff(filters: AdminFilters = {}) { return backend<AdminListVM<AdminStaffVM>>(`admin_staff${query(filters)}`, "/staff/login"); }
export async function getAdminDirectory(): Promise<AdminDirectoryVM> { return backend<AdminDirectoryVM>("admin_directory", "/staff/login"); }
export async function getChangeHistory(filters: ChangeFilters = {}): Promise<{ today: string; rows: ChangeVM[]; page: number; pages: number }> {
  return backend<{ today: string; rows: ChangeVM[]; page: number; pages: number }>(`admin_history${query(filters)}`, "/staff/login");
}
