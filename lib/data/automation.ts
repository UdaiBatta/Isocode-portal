import { cookies } from "next/headers";
import { backend } from "@/lib/backend";
import { readProto, requirePrototypeRole } from "@/lib/fixtures/state";
import { automationFor } from "@/lib/fixtures/views";
import { today } from "@/lib/clock";
import { dateLabel, inr } from "@/lib/format";
import { renderReminder } from "@/lib/reminder-text";
import type { AutomationVM, ReminderRow } from "@/lib/types";

type BackendReminder = Omit<ReminderRow, "body"> & { dueDate: string; payUrl: string };
type BackendAutomationVM = Omit<AutomationVM, "sent" | "upcoming" | "stopped" | "needsCall"> & {
  sent: BackendReminder[]; upcoming: BackendReminder[]; stopped: BackendReminder[]; needsCall: BackendReminder[];
};

function renderRows(rows: BackendReminder[], on: string): ReminderRow[] {
  return rows.map(({ dueDate, payUrl, ...row }) => ({
    ...row,
    body: row.step === null ? null : renderReminder(row.language, row.step, {
      student: row.studentName, amount: inr(row.amount), date: dateLabel(dueDate, row.language, on), link: payUrl,
    }),
  }));
}
async function getFixtureAutomation() {
  const state = await readProto();
  requirePrototypeRole(state, "accounts");
  if (state.centreId && state.centreId !== "MLV") {
    return { today: await today(), demo: true, unmatchedOpen: 0, sent: [], upcoming: [], stopped: [], needsCall: [], unmatched: [] } satisfies AutomationVM;
  }
  return automationFor(state, await today());
}

export async function getAutomation() {
  if ((await cookies()).get("sid")?.value) {
    const data = await backend<BackendAutomationVM>("automation", "/staff/login");
    return {
      ...data,
      sent: renderRows(data.sent, data.today),
      upcoming: renderRows(data.upcoming, data.today),
      stopped: renderRows(data.stopped, data.today),
      needsCall: renderRows(data.needsCall, data.today),
    };
  }
  return getFixtureAutomation();
}
