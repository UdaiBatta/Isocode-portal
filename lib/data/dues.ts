import { backend } from "@/lib/backend";
import type { DuesVM } from "@/lib/types";
export async function getDues(studentId?: string) {
  return backend<DuesVM>(`dues${studentId ? `?student=${encodeURIComponent(studentId)}` : ""}`);
}
