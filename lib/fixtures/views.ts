import { batches, centres, namedStudents, students } from "./catalog";
import { refundSnapshots, refundPolicy } from "./operations";
import type { ProtoState } from "./state";
import type { AgeingRow, AutomationVM, CounsellorVM, DashboardVM, DuesVM, InstalmentVM, LedgerVM, ReceiptVM, RefundVM, ReminderRow, TaskRow, StudentFilters, StudentRowVM, StudentStatus, StudentsVM } from "@/lib/types";
import { inr, dateLabel } from "@/lib/format";
import { t } from "@/lib/i18n";

export { refundPolicy };
const reminderSteps = [-7, -3, 0, 3, 7, 15, 30];
const ishitaSent = ["2026-10-03", "2026-10-07", "2026-10-10", "2026-10-13", "2026-10-17", "2026-10-25"];
const dueDates = {
  MLV: { JEE: ["2026-04-10", "2026-07-10", "2026-10-10", "2027-01-10"], NEET: ["2026-03-15", "2026-07-15", "2026-11-15"] },
  VSH: { JEE: ["2026-04-05", "2026-07-05", "2026-10-05", "2027-01-05"], NEET: ["2026-03-09", "2026-07-09", "2026-11-09"] },
  MSR: { JEE: ["2026-04-30", "2026-07-30", "2026-10-30", "2027-01-30"], NEET: ["2026-03-05", "2026-07-05", "2026-11-05"] },
  RJP: { JEE: ["2026-05-02", "2026-08-02", "2026-11-02", "2027-02-02"], NEET: ["2026-03-20", "2026-07-20", "2026-11-20"] },
};

// Date arithmetic here only changes fixture display labels and demo message dates.
function daysBetween(a: string, b: string) { return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000); }
function shifted(date: string, days: number) { return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10); }
export function studentFor(code: string) {
  const student = students.find((item) => item.code === code);
  if (!student) throw new Error("Student not found");
  return student;
}

export function ledgerFor(state: ProtoState, code: string, today: string): LedgerVM {
  const source = studentFor(code);
  const centreId = source.centreId ?? "MLV";
  const dates = dueDates[centreId as keyof typeof dueDates][source.batch.startsWith("JEE") ? "JEE" : "NEET"];
  const net = 12000000 - (source.discount ?? 0);
  const instalments: InstalmentVM[] = dates.map((dueDate, index) => ({
    id: `${code}-${index + 1}`, seq: index + 1, dueDate, amount: net / dates.length, paid: source.paid[index], balance: 0,
    status: "paid", partPaid: false, daysOverdue: 0, dueInDays: 0, payUrl: null,
  }));
  const paidOn: Record<string, string> = {};
  for (const payment of state.payments?.filter((item) => item.studentCode === code) ?? []) {
    let left = payment.amount;
    for (const instalment of instalments) {
      if (payment.instalmentId && instalment.id < payment.instalmentId) continue;
      const amount = Math.min(left, instalment.amount - instalment.paid);
      instalment.paid += amount;
      if (amount > 0) paidOn[instalment.id] = payment.on;
      left -= amount;
    }
  }
  for (const instalment of instalments) {
    const days = daysBetween(today, instalment.dueDate);
    instalment.balance = instalment.amount - instalment.paid;
    instalment.partPaid = instalment.paid > 0 && instalment.balance > 0;
    instalment.status = !instalment.balance ? "paid" : days > 0 ? "overdue" : days === 0 ? "due_today" : "upcoming";
    instalment.daysOverdue = instalment.balance > 0 ? Math.max(0, days) : 0;
    instalment.dueInDays = instalment.balance > 0 ? Math.max(0, -days) : 0;
    instalment.payUrl = instalment.balance > 0 ? `/mock-gateway/${instalment.id}` : null;
  }
  const refundStatus = state.refunds?.[code]?.status ?? refundSnapshots[code]?.status;
  const withdrawn = refundStatus === "approved" || refundStatus === "paid";
  const paid = instalments.reduce((sum, item) => sum + item.paid, 0);
  const sent = state.sent ?? [];
  const held = queueFor(state).filter((item) => item.status === "open");
  return {
    student: { id: code, code, name: source.name, batch: source.batch, centre: centres.find((item) => item.id === centreId)!.name, status: withdrawn ? "withdrawn" : "active" },
    plan: { gross: 12000000, discount: source.discount ?? 0, discountReason: source.discount ? "Merit" : null, net, paid, balance: net - paid },
    instalments,
    payments: receiptsFor(state, code).map((receipt) => ({ id: receipt.id, on: receipt.issuedOn, method: receipt.method, amount: receipt.amount, receiptId: receipt.id })),
    timeline: instalments.map((instalment) => {
      const history = [
        ...(code === "STU-0587" && instalment.seq === 3 ? ishitaSent.map((on, index) => ({ step: reminderSteps[index], on, language: source.language })) : []),
        ...(code === "STU-0733" && instalment.seq === 2 ? [{ step: 30, on: "2026-08-09", language: source.language }] : []),
        ...sent.filter((item) => item.instalmentId === instalment.id).map((item) => ({ step: item.step, on: item.on, language: state.languages?.[source.phone] ?? source.language })),
      ];
      const stopped = !instalment.balance ? `Paid ${paidOn[instalment.id] ?? instalment.dueDate}` : withdrawn ? "Withdrawn" : held.some((item) => item.suggested?.instalmentId === instalment.id) ? "Payment being checked" : null;
      const step = reminderSteps.find((value) => value > Math.max(-Infinity, ...history.map((item) => item.step)) && shifted(instalment.dueDate, value) >= today);
      return { instalmentId: instalment.id, sent: history, next: stopped || step === undefined ? null : { step, on: shifted(instalment.dueDate, step) }, stopped };
    }),
    refund: refundStatus && refundStatus !== "new" ? { id: code, status: refundStatus } : null,
    guardianPhone: source.phone,
  };
}

export function receiptsFor(state: ProtoState, code: string): ReceiptVM[] {
  const source = studentFor(code);
  const centreId = source.centreId ?? "MLV";
  const dates = dueDates[centreId as keyof typeof dueDates][source.batch.startsWith("JEE") ? "JEE" : "NEET"];
  const payments = [
    ...source.paid.flatMap((amount, index) => amount ? [{ id: `${code}-receipt-${index + 1}`, amount, on: dates[index], method: "bank", seq: Number(code.slice(4)) * 10 + index + 1 }] : []),
    ...(state.payments ?? []).flatMap((payment, index) => payment.studentCode === code ? [{ id: `demo-receipt-${index + 1}`, amount: payment.amount, on: payment.on, method: payment.method, seq: 100000 + index + 1 }] : []),
  ];
  return payments.map((payment) => {
    const taxable = Math.round(payment.amount * 10000 / 11800);
    const gst = payment.amount - taxable;
    const year = Number(payment.on.slice(0, 4)) - (payment.on.slice(5, 7) < "04" ? 1 : 0);
    return {
      id: payment.id, number: `${centreId}/${year}-${String(year + 1).slice(2)}/${String(payment.seq).padStart(6, "0")}`,
      issuedOn: payment.on, amount: payment.amount, method: payment.method, taxable, cgst: Math.floor(gst / 2), sgst: gst - Math.floor(gst / 2),
      student: { code, name: source.name, batch: source.batch, centre: centres.find((item) => item.id === centreId)!.name },
    };
  }).sort((a, b) => b.issuedOn.localeCompare(a.issuedOn) || b.id.localeCompare(a.id));
}

export function queueFor(state: ProtoState): AutomationVM["unmatched"] {
  const fixtures = [
    { id: "queue-kavya", amount: 2900000, reason: "amount_mismatch", instalmentId: "STU-0771-3" },
    { id: "queue-unknown", amount: 1200000, reason: "unknown_reference", instalmentId: undefined },
    { id: "queue-paid", amount: 3000000, reason: "already_paid", instalmentId: "STU-0735-3" },
    { id: "queue-withdrawn", amount: 3000000, reason: "student_withdrawn", instalmentId: "STU-0802-4" },
    { id: "queue-excess", amount: 500000, reason: "excess_counter_payment", instalmentId: "STU-0772-3" },
    { id: "queue-unknown-2", amount: 1800000, reason: "unknown_reference", instalmentId: undefined },
    ...(state.held ?? []),
  ] as const;
  return fixtures.map((item) => ({
    id: item.id, amount: item.amount, receivedOn: "on" in item ? item.on : "2026-11-02", reference: item.instalmentId ?? `DEMO-${item.id}`, reason: item.reason,
    suggested: item.instalmentId ? { instalmentId: item.instalmentId, studentCode: item.instalmentId.slice(0, 8), studentName: studentFor(item.instalmentId.slice(0, 8)).name } : null,
    status: state.resolved?.[item.id]?.action === "match" ? "matched" : state.resolved?.[item.id]?.action === "reject" ? "rejected" : "open",
  }));
}

export function refundFor(state: ProtoState, code: string, today: string): RefundVM {
  const student = studentFor(code);
  const snapshot = refundSnapshots[code];
  const saved = state.refunds?.[code];
  const ledger = ledgerFor(state, code, today);
  const extraPaid = ledger.plan.paid - student.paid.reduce((sum, amount) => sum + amount, 0);
  const amount = snapshot ? snapshot.calc.refund - snapshot.calc.stillPayable + extraPaid : 0;
  const refund = Math.max(0, amount);
  const taxable = Math.round(refund * 10000 / 11800);
  const gst = refund - taxable;
  const calc = snapshot ? { ...snapshot.calc, refund, stillPayable: Math.max(0, -amount), taxable, cgst: Math.floor(gst / 2), sgst: gst - Math.floor(gst / 2) } : null;
  const blocked = queueFor(state).find((item) => item.status === "open" && item.suggested?.studentCode === code);
  return {
    student: { code, name: student.name }, policy: { version: "v1" },
    input: { withdrawalDate: saved?.withdrawalDate ?? snapshot?.date ?? null, reason: saved?.reason ?? (snapshot?.status === "new" ? null : "Personal") },
    calc, status: saved?.status ?? snapshot?.status ?? "new",
    blockedBy: blocked ? { unmatchedId: blocked.id, amount: blocked.amount } : null,
    overdueDeadline: !!calc && calc.deadline < today && (saved?.status ?? snapshot?.status) !== "paid",
  };
}

export function duesFor(state: ProtoState, code: string, today: string): DuesVM {
  const source = studentFor(code);
  const ledger = ledgerFor(state, code, today);
  const current = ledger.instalments.find((item) => item.balance > 0) ?? null;
  const next = current ? { amount: current.balance, dueDate: current.dueDate } : null;
  const review = queueFor(state).some((item) => item.status === "open" && item.suggested?.instalmentId === current?.id);
  const refund = refundFor(state, code, today);
  return {
    children: students.filter((item) => item.phone === source.phone).map((item) => ({ studentId: item.code, fullName: item.name })), selectedStudentId: code,
    mode: ledger.student.status === "withdrawn" ? "withdrawn" : review ? "review" : current && current.dueInDays <= 30 ? "pay" : "clear",
    current, next, moreUnpaid: Math.max(0, ledger.instalments.filter((item) => item.balance > 0).length - 1), instalments: ledger.instalments,
    refund: ledger.student.status === "withdrawn" && refund.calc && (refund.status === "approved" || refund.status === "paid") ? { amount: refund.calc.refund, stillPayable: refund.calc.stillPayable, status: refund.status, deadline: refund.calc.deadline } : null,
  };
}

export function dashboardFor(state: ProtoState, today: string, filters: { group?: "centre" | "batch"; centre?: string; batch?: string } = {}): DashboardVM {
  const scopedBatches = batches.filter((batch) => (!state.centreId || batch.centreId === state.centreId) && (!filters.centre || batch.centreId === filters.centre) && (!filters.batch || batch.id === filters.batch));
  const ledgers = students.filter((source) => scopedBatches.some((batch) => batch.centreId === (source.centreId ?? "MLV") && batch.name === source.batch)).map((source) => ledgerFor(state, source.code, today));
  const rows: AgeingRow[] = scopedBatches.map((batch) => {
    const row: AgeingRow = { id: batch.id, label: batch.name, kind: "batch", studentsWithDues: 0, outstanding: 0, notDue: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0 };
    for (const ledger of ledgers.filter((item) => item.student.batch === batch.name && item.student.centre === centres.find((item) => item.id === batch.centreId)!.name && item.student.status === "active")) {
      if (ledger.plan.balance > 0) row.studentsWithDues++;
      for (const instalment of ledger.instalments) {
        row.outstanding += instalment.balance;
        const days = instalment.daysOverdue;
        row[days <= 0 ? "notDue" : days <= 30 ? "d1_30" : days <= 60 ? "d31_60" : days <= 90 ? "d61_90" : "d90p"] += instalment.balance;
      }
    }
    return row;
  });
  const grouped = filters.group === "batch" ? rows : centres.filter((centre) => scopedBatches.some((batch) => batch.centreId === centre.id)).map((centre) => {
    const children = rows.filter((row) => row.id.startsWith(centre.id));
    const total: AgeingRow = { id: centre.id, label: centre.name, kind: "centre", studentsWithDues: 0, outstanding: 0, notDue: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0, children };
    for (const row of children) for (const key of ["studentsWithDues", "outstanding", "notDue", "d1_30", "d31_60", "d61_90", "d90p"] as const) total[key] += row[key];
    return total;
  });
  const refunds = ledgers.map((ledger) => refundFor(state, ledger.student.code, today)).filter((refund) => refund.status === "approved");
  return {
    today, canPickCentre: !state.centreId,
    totals: { outstanding: rows.reduce((sum, row) => sum + row.outstanding, 0), overdue: rows.reduce((sum, row) => sum + row.outstanding - row.notDue, 0), over60Pct: 12.1, refundsDue: refunds.length, refundsLate: refunds.filter((item) => item.overdueDeadline).length },
    rows: grouped,
    students: ledgers.filter((ledger) => ledger.student.status === "active" && ledger.plan.balance > 0).map((ledger) => ({ code: ledger.student.code, name: ledger.student.name, balance: ledger.plan.balance, daysOverdue: Math.max(0, ...ledger.instalments.map((item) => item.daysOverdue)) })),
  };
}

const STUDENTS_PER_PAGE = 25;

export function studentsFor(state: ProtoState, today: string, filters: StudentFilters = {}): StudentsVM {
  const scoped = batches.filter((batch) => (!state.centreId || batch.centreId === state.centreId) && (!filters.centre || batch.centreId === filters.centre) && (!filters.batch || batch.id === filters.batch));
  const query = filters.q?.trim().toLowerCase();
  const held = queueFor(state).filter((item) => item.status === "open");
  const all = students.filter((source) => scoped.some((batch) => batch.centreId === (source.centreId ?? "MLV") && batch.name === source.batch) && (!query || `${source.name} ${source.code}`.toLowerCase().includes(query))).map((source): StudentRowVM => {
    const ledger = ledgerFor(state, source.code, today);
    const open = ledger.instalments.find((item) => item.balance > 0);
    const line = ledger.timeline.find((item) => item.instalmentId === open?.id);
    const daysOverdue = Math.max(...ledger.instalments.map((item) => item.daysOverdue));
    const latest = ledger.payments.toSorted((a, b) => b.on.localeCompare(a.on))[0];
    const status: StudentStatus = ledger.student.status === "withdrawn" ? "withdrawn" : !ledger.plan.balance ? "clear" : held.some((item) => item.suggested?.studentCode === source.code) ? "checking" : daysOverdue ? "overdue" : "upcoming";
    return { id: source.code, code: source.code, name: source.name, batch: source.batch, centre: ledger.student.centre, status, balance: ledger.plan.balance, daysOverdue, next: line?.next?.on ?? null, stopped: line?.stopped ?? null, lastPayment: latest ? { on: latest.on, method: latest.method } : null };
  }).sort((a, b) => b.daysOverdue - a.daysOverdue || b.balance - a.balance || a.code.localeCompare(b.code));
  const count = (status: StudentStatus) => all.filter((row) => row.status === status).length;
  const matching = all.filter((row) => !filters.status || (filters.status === "over60" ? row.status === "overdue" && row.daysOverdue > 60 : row.status === filters.status));
  const pages = Math.max(1, Math.ceil(matching.length / STUDENTS_PER_PAGE));
  const page = Math.min(filters.page ?? 1, pages);
  return {
    today, canPickCentre: !state.centreId, page, pages,
    rows: matching.slice((page - 1) * STUDENTS_PER_PAGE, page * STUDENTS_PER_PAGE),
    counts: { all: all.length, overdue: count("overdue"), over60: all.filter((row) => row.status === "overdue" && row.daysOverdue > 60).length, upcoming: count("upcoming"), clear: count("clear"), checking: count("checking"), withdrawn: count("withdrawn") },
  };
}

export function automationFor(state: ProtoState, today: string): AutomationVM {
  const result: AutomationVM = { today, demo: true, unmatchedOpen: queueFor(state).filter((item) => item.status === "open").length, sent: [], upcoming: [], stopped: [], needsCall: [], unmatched: queueFor(state) };
  for (const source of namedStudents) {
    const ledger = ledgerFor(state, source.code, today);
    for (const instalment of ledger.instalments) {
      const timeline = ledger.timeline.find((item) => item.instalmentId === instalment.id)!;
      const language = state.languages?.[source.phone] ?? source.language;
      const message = (step: number) => t(language, step < 0 ? "reminder.before" : step > 0 ? "reminder.after" : "reminder.today", { student: source.name, amount: inr(instalment.balance || instalment.amount), date: dateLabel(instalment.dueDate, language, today), link: `/pay/${instalment.id}` });
      const row: ReminderRow = { instalmentId: instalment.id, studentCode: source.code, studentName: source.name, step: timeline.next?.step ?? null, on: timeline.next?.on ?? null, language, amount: instalment.balance, body: timeline.next ? message(timeline.next.step) : null, stoppedReason: timeline.stopped };
      result.sent.push(...timeline.sent.map((entry) => {
        const amount = state.sent?.find((sent) => sent.instalmentId === instalment.id && sent.step === entry.step)?.amount ?? (source.code === "STU-0587" && entry.on >= instalment.dueDate ? 1500000 : instalment.amount);
        return { ...row, amount, step: entry.step, on: entry.on, language: entry.language, body: t(entry.language, entry.step < 0 ? "reminder.before" : entry.step > 0 ? "reminder.after" : "reminder.today", { student: source.name, amount: inr(amount), date: dateLabel(instalment.dueDate, entry.language, today), link: `/pay/${instalment.id}` }), stoppedReason: null };
      }));
      if (row.stoppedReason) result.stopped.push(row);
      else if (row.on && daysBetween(row.on, today) <= 7) result.upcoming.push(row);
      if (!row.stoppedReason && instalment.daysOverdue > 30) result.needsCall.push(row);
    }
  }
  return result;
}

export function counsellorFor(state: ProtoState): CounsellorVM {
  const riya = studentFor("STU-0733");
  const base: TaskRow = { id: "task-riya", studentCode: riya.code, studentName: riya.name, batch: riya.batch, guardianPhone: riya.phone, score: 90, band: "high", reasons: ["2 instalments overdue, oldest 115 days", "Attendance 60% in the last 4 weeks, was 90%", "Test scores down from 69% to 49%"], brief: "Flagged because several signals changed. Ask how things are going; this call is about support, not fees.", briefSource: "template", createdOn: "2026-11-02", status: "open", note: null };
  const closed: TaskRow[] = students.filter((student) => student.code >= "STU-1001" && student.code <= "STU-1011").map((student, index) => ({ ...base, id: `task-${student.code}`, studentCode: student.code, studentName: student.name, batch: student.batch, guardianPhone: student.phone, status: index < 8 ? "called" : "false_flag", note: index < 8 ? "Synthetic demo outcome: support call completed." : "Synthetic demo outcome: family confirmed the flag was wrong.", briefSource: index === 0 ? "llm" : "template", brief: index === 0 ? "Sample AI-written summary: attendance and test trends changed. Ask the parent how the student has been finding the course." : base.brief }));
  const outcome = state.outcomes?.[base.id];
  if (outcome) closed.push({ ...base, status: outcome.outcome, note: outcome.note });
  return {
    accuracy: { genuine: closed.filter((task) => task.status === "called").length, total: closed.length }, open: outcome ? [] : [base], closed,
    watch: [{ studentCode: "STU-0734", studentName: "Arjun Yadav", batch: "NEET 2027 Evening", score: 40, reasons: ["2 instalments overdue, oldest 232 days"] }],
    unknown: [{ studentCode: "STU-0735", studentName: "Neha Kumawat", batch: "JEE 2027 Morning", missing: "Fewer than four attendance weeks and three tests." }],
  };
}

export function dueStep(instalment: InstalmentVM, sent: number[], today: string): number | null {
  const latest = reminderSteps.filter((step) => step <= daysBetween(today, instalment.dueDate)).at(-1);
  return latest !== undefined && latest > Math.max(-Infinity, ...sent) ? latest : null;
}
