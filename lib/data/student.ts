import { parentContext } from "./scope";
import { ledgerFor } from "@/lib/fixtures/views";
import { students } from "@/lib/fixtures/catalog";
import { today } from "@/lib/clock";
import type { StudentInfoVM } from "@/lib/types";

// All 16 batches run this session (docs/PLAN.md, batches).
const SESSION = { start: "2026-04-01", end: "2027-03-31" };

export async function getFamily(studentId?: string) {
  const { student } = await parentContext(studentId);
  return { selected: student.code, family: students.filter((item) => item.phone === student.phone).map((item) => ({ studentId: item.code, fullName: item.name })) };
}

export async function getStudentInfo(studentId?: string): Promise<StudentInfoVM> {
  const { state, student } = await parentContext(studentId);
  const ledger = ledgerFor(state, student.code, await today());
  const [exam, examYear, timing] = student.batch.split(" ");
  return {
    code: student.code, name: student.name, batch: student.batch, centre: ledger.student.centre, status: ledger.student.status,
    enrolledOn: student.enrolledOn, guardianPhone: student.phone, preferredLanguage: state.languages?.[student.phone] ?? student.language,
    course: { exam: exam as "JEE" | "NEET", examYear, timing: timing as "Morning" | "Evening", sessionStart: SESSION.start, sessionEnd: SESSION.end, instalments: ledger.instalments.length },
  };
}
