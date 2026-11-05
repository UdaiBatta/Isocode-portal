import { readProto, requirePrototypeRole } from "@/lib/fixtures/state";
import { centres, batches, students } from "@/lib/fixtures/catalog";
import { today } from "@/lib/clock";
import { getLedger } from "@/lib/data/ledger";
import { backend, getMe } from "@/lib/backend";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function getStaffPageContext() {
  const me = await getMe();
  if (!me && (await cookies()).get("sid")?.value) redirect("/staff/login");
  const state = me ?? await readProto();
  return { role: state.role ?? null, today: me?.today ?? await today(), demo: process.env.DEMO_MODE === "true" };
}

export async function getStaffDirectory() {
  if ((await cookies()).get("sid")?.value) {
    return backend<{ centres: { id: string; name: string }[]; batches: { id: string; name: string; centreId: string }[];
      students: { code: string; name: string; centreId: string; batchId: string }[] }>("staff_directory", "/staff/login");
  }
  const state = await readProto();
  requirePrototypeRole(state, "accounts");
  return {
    centres: centres.filter((item) => !state.centreId || item.id === state.centreId),
    batches: batches.filter((item) => !state.centreId || item.centreId === state.centreId),
    students: students.filter((item) => !state.centreId || (item.centreId ?? "MLV") === state.centreId).map((item) => ({ code: item.code, name: item.name, centreId: item.centreId ?? "MLV", batchId: batches.find((batch) => batch.centreId === (item.centreId ?? "MLV") && batch.name === item.batch)?.id })),
  };
}

export async function getPaymentCandidates() {
  if ((await cookies()).get("sid")?.value) {
    return (await backend<{ candidates: { code: string; name: string; instalments: { id: string; balance: number; seq: number }[] }[] }>("payment_candidates", "/staff/login")).candidates;
  }
  const directory = await getStaffDirectory();
  const ledgers = await Promise.all(directory.students.map((student) => getLedger(student.code)));
  return ledgers.filter((ledger) => ledger.student.status === "active").map((ledger) => ({ code: ledger.student.code, name: ledger.student.name, instalments: ledger.instalments.filter((item) => item.balance > 0).map((item) => ({ id: item.id, balance: item.balance, seq: item.seq })) }));
}
