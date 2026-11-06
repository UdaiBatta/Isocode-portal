import { backend } from "@/lib/backend";
import type { ProgressVM } from "@/lib/types";
export async function getProgress(studentId?: string) {
  return backend<ProgressVM>(`progress${studentId ? `?student=${encodeURIComponent(studentId)}` : ""}`);
}
