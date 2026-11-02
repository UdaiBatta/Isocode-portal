import { readProto } from "@/lib/fixtures/state";
import { students } from "@/lib/fixtures/catalog";

export async function getAuthState() {
  const state = await readProto();
  return { role: state.role ?? null, phone: state.phone ?? null, consent: state.consent ?? false, declined: state.declined ?? false, children: students.filter((student) => student.phone === state.phone).map((student) => ({ id: student.code, name: student.name })) };
}
