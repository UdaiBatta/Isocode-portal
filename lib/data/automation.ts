import { cookies } from "next/headers";
import { backend } from "@/lib/backend";
import { readProto, requirePrototypeRole } from "@/lib/fixtures/state";
import { automationFor } from "@/lib/fixtures/views";
import { today } from "@/lib/clock";
import { dateLabel, inr } from "@/lib/format";
import { renderReminder } from "@/lib/reminder-text";
import type { AutomationCountsVM, AutomationList, AutomationPageVM, AutomationVM, ReminderRow } from "@/lib/types";

const PAGE_SIZE = 25;
type QueueRow = AutomationVM["unmatched"][number];
type BackendReminder = Omit<ReminderRow, "body"> & { dueDate: string; payUrl: string };
type BackendAutomationPage = Omit<AutomationPageVM, "sent" | "upcoming" | "stopped" | "needsCall"> & {
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
  return getFixtureAutomation();
}

export async function getAutomationCounts(): Promise<AutomationCountsVM> {
  if ((await cookies()).get("sid")?.value) return backend<AutomationCountsVM>("automation_counts", "/staff/login");
  const view = await getFixtureAutomation();
  return { unmatchedOpen: view.unmatchedOpen, needsCall: view.needsCall.length };
}

export async function getAutomationPage(list: AutomationList, requestedPage: number, focus?: string): Promise<AutomationPageVM> {
  if ((await cookies()).get("sid")?.value) {
    const query = new URLSearchParams({ list, page: String(requestedPage) });
    if (focus) query.set("focus", focus);
    const data = await backend<BackendAutomationPage>(`automation?${query}`, "/staff/login");
    return {
      ...data,
      sent: renderRows(data.sent, data.today),
      upcoming: renderRows(data.upcoming, data.today),
      stopped: renderRows(data.stopped, data.today),
      needsCall: renderRows(data.needsCall, data.today),
    };
  }

  const view = await getFixtureAutomation();
  const rows = view[list] as QueueRow[] | ReminderRow[];
  const focusedIndex = list === "unmatched" && focus ? rows.findIndex((row) => (row as QueueRow).id === focus) : -1;
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(focusedIndex >= 0 ? Math.floor(focusedIndex / PAGE_SIZE) + 1 : requestedPage, totalPages);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const meta = { list, page, pageSize: PAGE_SIZE, total, totalPages };
  if (list === "unmatched") {
    return { ...view, ...meta, sent: [], upcoming: [], stopped: [], needsCall: [], unmatched: pageRows as QueueRow[] };
  }
  return { ...view, ...meta, sent: [], upcoming: [], stopped: [], needsCall: [], unmatched: [], [list]: pageRows as ReminderRow[] };
}
