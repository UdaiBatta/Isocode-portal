import { backend } from "@/lib/backend";
import type { StudentFilters, StudentsVM } from "@/lib/types";
export async function getStudents(filters: StudentFilters = {}) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
  return backend<StudentsVM>(`students?${query}`, "/staff/login");
}
