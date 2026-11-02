"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { dateSchema, mutateProto, fail } from "@/lib/fixtures/state";
import { namedStudents } from "@/lib/fixtures/catalog";
import { ledgerFor, queueFor, dueStep } from "@/lib/fixtures/views";
import { today } from "@/lib/clock";

export async function setDemoDate(input: unknown) {
  return mutateProto("accounts", (state) => {
    const { date } = z.object({ date: dateSchema }).parse(input);
    state.date = date;
    return { date };
  });
}

export async function runRemindersNow() {
  return mutateProto("accounts", async (state) => {
    const on = await today();
    const sent = state.sent ??= [];
    const before = sent.length;
    for (const student of namedStudents) {
      const ledger = ledgerFor(state, student.code, on);
      if (ledger.student.status !== "active") continue;
      for (const instalment of ledger.instalments) {
        if (!instalment.balance || queueFor(state).some((item) => item.status === "open" && item.suggested?.instalmentId === instalment.id)) continue;
        const history = ledger.timeline.find((item) => item.instalmentId === instalment.id)!.sent;
        const step = dueStep(instalment, history.map((item) => item.step), on);
        if (step !== null) {
          if (sent.length >= 8) fail("demo_full", "Reset the demo before running more reminder scenarios.");
          sent.push({ instalmentId: instalment.id, step, on, amount: instalment.balance, language: state.languages?.[student.phone] ?? student.language });
        }
      }
    }
    return { sent: sent.length - before, skipped: 0 };
  });
}

export async function resetDemo() {
  const result = await mutateProto("accounts", () => ({}));
  if (result.ok) (await cookies()).delete("proto");
  return result;
}
