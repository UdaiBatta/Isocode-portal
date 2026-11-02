import { readProto } from "@/lib/fixtures/state";
import { ledgerFor, studentFor } from "@/lib/fixtures/views";
import { today } from "@/lib/clock";

export async function getPayDetails(token: string) {
  if (!/^STU-\d{4}-[1-4]$/.test(token)) return null;
  try {
    const state = await readProto();
    const code = token.slice(0, 8);
    const ledger = ledgerFor(state, code, await today());
    const instalment = ledger.instalments.find((item) => item.id === token);
    if (!instalment || ledger.student.status === "withdrawn") return null;
    return { firstName: studentFor(code).name.split(" ")[0], amount: instalment.balance, dueDate: instalment.dueDate, paid: instalment.balance === 0, payUrl: instalment.payUrl };
  } catch { return null; }
}
