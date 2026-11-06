import { backend } from "@/lib/backend";
import { dateLabel, inr } from "@/lib/format";
import { renderReminder } from "@/lib/reminder-text";
import type { AutomationCountsVM, AutomationList, AutomationPageVM, ReminderRow } from "@/lib/types";
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

export async function getAutomationCounts(): Promise<AutomationCountsVM> { return backend<AutomationCountsVM>("automation_counts", "/staff/login"); }
export async function getAutomationPage(list: AutomationList, requestedPage: number, focus?: string): Promise<AutomationPageVM> {
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
