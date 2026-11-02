import { readProto, requirePrototypeRole } from "@/lib/fixtures/state";
import { centres, batches, students } from "@/lib/fixtures/catalog";
import { today } from "@/lib/clock";
import { getLedger } from "@/lib/data/ledger";

export async function getStaffPageContext() {
  const state = await readProto();
  return { role: state.role ?? null, today: await today(), demo: process.env.DEMO_MODE === "true" };
}

export async function getStaffDirectory() {
  const state = await readProto();
  requirePrototypeRole(state, "accounts");
  return {
    centres: centres.filter((item) => !state.centreId || item.id === state.centreId),
    batches: batches.filter((item) => !state.centreId || item.centreId === state.centreId),
    students: students.filter((item) => !state.centreId || (item.centreId ?? "MLV") === state.centreId).map((item) => ({ code: item.code, name: item.name, centreId: item.centreId ?? "MLV", batchId: batches.find((batch) => batch.centreId === (item.centreId ?? "MLV") && batch.name === item.batch)?.id })),
  };
}

export async function getPaymentCandidates() {
  const directory = await getStaffDirectory();
  const ledgers = await Promise.all(directory.students.map((student) => getLedger(student.code)));
  return ledgers.filter((ledger) => ledger.student.status === "active").map((ledger) => ({ code: ledger.student.code, name: ledger.student.name, instalments: ledger.instalments.filter((item) => item.balance > 0).map((item) => ({ id: item.id, balance: item.balance, seq: item.seq })) }));
}
