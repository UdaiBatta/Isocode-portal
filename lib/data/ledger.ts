import { backend } from "@/lib/backend";
import type { LedgerVM, ProgressVM, StudentInfoVM } from "@/lib/types";
export async function getLedger(code: string) {
  return backend<LedgerVM>(`ledger?student=${encodeURIComponent(code)}`, "/staff/login");
}
export async function getStudentRecord(code: string) {
  return backend<{ info: StudentInfoVM; progress: ProgressVM }>(`student_record?student=${encodeURIComponent(code)}`, "/staff/login");
}
