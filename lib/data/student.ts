import { backend } from "@/lib/backend";
import type { StudentInfoVM } from "@/lib/types";
export async function getFamily(studentId?: string) {
  return backend<{ selected: string; family: { studentId: string; fullName: string }[] }>(`family${studentId ? `?student=${encodeURIComponent(studentId)}` : ""}`);
}
export async function getStudentInfo(studentId?: string): Promise<StudentInfoVM> {
  return backend<StudentInfoVM>(`student_info${studentId ? `?student=${encodeURIComponent(studentId)}` : ""}`);
}
