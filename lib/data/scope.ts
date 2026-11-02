import { readProto, requirePrototypeRole, fail, type ProtoState } from "@/lib/fixtures/state";
import { students } from "@/lib/fixtures/catalog";

export async function parentContext(code?: string) {
  const state = await readProto();
  requirePrototypeRole(state, "parent");
  const linked = students.filter((student) => student.phone === (state.phone ?? "+919000000587"));
  const student = linked.find((item) => item.code === (code ?? linked[0]?.code));
  if (!student) fail("forbidden", "Student not found in this prototype family.");
  return { state, student };
}

export function requireCentre(state: ProtoState, code: string) {
  const student = students.find((item) => item.code === code);
  if (!student) fail("not_found", "Student not found.");
  if (state.centreId && state.centreId !== (student.centreId ?? "MLV")) fail("forbidden", "Student not found in this prototype centre.");
  return student;
}
