import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { jar, cookieWrites } = vi.hoisted(() => ({ jar: new Map<string, string>(), cookieWrites: [] as { name: string; secure?: boolean }[] }));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (name: string) => jar.has(name) ? { value: jar.get(name)! } : undefined,
  set: (name: string, value: string, options?: { secure?: boolean }) => { cookieWrites.push({ name, secure: options?.secure }); jar.set(name, value); },
  delete: (name: string) => jar.delete(name),
}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getDues } from "@/lib/data/dues";
import { getLedger } from "@/lib/data/ledger";
import { getDashboard } from "@/lib/data/dashboard";
import { getAutomation } from "@/lib/data/automation";
import { getRefund } from "@/lib/data/refund";
import { getCounsellor } from "@/lib/data/counsellor";
import { getReceipt, getReceipts } from "@/lib/data/receipts";
import { getProgress } from "@/lib/data/progress";
import { getPayDetails, getPaymentResult } from "@/lib/data/payments";
import { openPrototypeRoute } from "@/lib/actions/prototype";
import { getAuthState } from "@/lib/data/auth";
import { submitMockPayment, recordCounterPayment, resolveUnmatched } from "@/lib/actions/payments";
import { saveRefundDraft, approveRefund, markRefundPaid } from "@/lib/actions/refund";
import { setDemoDate, runRemindersNow, resetDemo } from "@/lib/actions/demo";
import { closeTask, ensureCallBrief } from "@/lib/actions/counsellor";
import { grantConsent, logout } from "@/lib/actions/auth";
import { readProto } from "@/lib/fixtures/state";
import { students, namedStudents, batches, centres } from "@/lib/fixtures/catalog";
import { today } from "@/lib/clock";

function session(values: object) { jar.set("proto", JSON.stringify({ ...JSON.parse(jar.get("proto") ?? "{}"), ...values })); }

beforeEach(() => { jar.clear(); cookieWrites.length = 0; vi.stubEnv("NEXT_PUBLIC_PROTO", "1"); });
afterEach(() => vi.unstubAllEnvs());

describe("prototype fixtures and state changes", () => {
  it("bounds reviewer role preparation to known prototype links", async () => {
    expect(await openPrototypeRoute({ key: "../../admin", state: "normal" })).toMatchObject({ ok: false });
    expect(await openPrototypeRoute({ key: "consent", state: "normal" })).toMatchObject({ ok: true, next: "/consent" });
    expect(await getAuthState()).toMatchObject({ role: "parent", consent: false });
    expect(await openPrototypeRoute({ key: "dashboard", state: "empty" })).toMatchObject({ ok: true, next: "/staff/dashboard?state=empty" });
    expect(await getAuthState()).toMatchObject({ role: "accounts" });
  });
  it("matches the three supplied sample rows and keeps every batch populated", async () => {
    expect(namedStudents).toHaveLength(12);
    expect(centres).toHaveLength(4);
    expect(batches).toHaveLength(16);
    for (const batch of batches) expect(students.some((student) => student.batch === batch.name && (student.centreId ?? "MLV") === batch.centreId)).toBe(true);
    expect((await getLedger("STU-0412")).instalments[2]).toMatchObject({ amount: 3000000, paid: 3000000, balance: 0, status: "paid" });
    expect((await getDues()).current).toMatchObject({ amount: 3000000, paid: 1500000, balance: 1500000, daysOverdue: 23, partPaid: true });
    expect((await getLedger("STU-0219")).instalments[2]).toMatchObject({ amount: 4000000, paid: 0, dueInDays: 13, status: "upcoming" });
    const dashboard = await getDashboard({ group: "batch" });
    expect(dashboard.rows).toHaveLength(16);
    expect(dashboard.totals.outstanding).toBe(dashboard.rows.reduce((sum, row) => sum + row.outstanding, 0));
    for (const row of dashboard.rows) expect(row.outstanding).toBe(row.notDue + row.d1_30 + row.d31_60 + row.d61_90 + row.d90p);
    expect((await getAutomation()).unmatched).toHaveLength(6);
    expect(new Set((await getAutomation()).sent.map((row) => row.language))).toEqual(new Set(["en", "hi"]));
    expect((await getAutomation()).upcoming.some((row) => row.language === "hi")).toBe(true);
    expect(new Set((await getCounsellor()).closed.map((task) => task.briefSource))).toEqual(new Set(["llm", "template"]));
    expect((await getRefund("STU-0801")).status).toBe("draft");
    expect((await getRefund("STU-0802")).status).toBe("approved");
    expect((await getRefund("STU-0803")).overdueDeadline).toBe(true);
    expect((await getRefund("STU-0804")).status).toBe("paid");
  });

  it("paying Ishita changes dues, ledger, GST receipt, batch total and stopped reminder together", async () => {
    const before = await getDashboard({ group: "batch" });
    const result = await submitMockPayment({ token: "STU-0587-3", outcome: "success" });
    expect(result).toMatchObject({ ok: true, result: "paid", receiptId: "demo-receipt-1" });
    expect((await getDues()).mode).toBe("clear");
    expect((await getLedger("STU-0587")).instalments[2].balance).toBe(0);
    expect((await getLedger("STU-0587")).timeline[0].stopped).toBe("Paid 2026-04-10");
    const after = await getDashboard({ group: "batch" });
    expect(before.totals.outstanding - after.totals.outstanding).toBe(1500000);
    expect(before.rows.find((row) => row.id === "MLV-2")!.outstanding - after.rows.find((row) => row.id === "MLV-2")!.outstanding).toBe(1500000);
    expect((await getAutomation()).stopped.find((row) => row.instalmentId === "STU-0587-3")?.stoppedReason).toBe("Paid 2026-11-02");
    const receipt = await getReceipt("demo-receipt-1");
    expect(receipt).toMatchObject({ amount: 1500000, taxable: 1271186, cgst: 114407, sgst: 114407 });
    expect(receipt.taxable + receipt.cgst + receipt.sgst).toBe(receipt.amount);
    expect(await submitMockPayment({ token: "STU-0587-3", outcome: "success" })).toMatchObject({ ok: true, result: "already_paid" });
    expect(await getReceipts()).toHaveLength(4);
  });

  it("progress is scoped to the family, matches the risk reasons and stops when a student leaves", async () => {
    const pct = (rows: { attended: number; held: number }[]) => rows.reduce((sum, row) => sum + row.attended, 0) * 100 / rows.reduce((sum, row) => sum + row.held, 0);
    const mean = (rows: { score: number }[]) => rows.reduce((sum, row) => sum + row.score, 0) / rows.length;
    session({ role: "parent", phone: "+919000000733", consent: true });
    const riya = await getProgress();
    expect(pct(riya.attendance.slice(0, 4))).toBe(60);
    expect(pct(riya.attendance.slice(4, 8))).toBe(90);
    expect(mean(riya.tests.slice(0, 2))).toBe(49);
    expect(mean(riya.tests.slice(2, 5))).toBe(69);
    await expect(getProgress("STU-0587")).rejects.toThrow();
    session({ phone: "+919000000803" });
    expect((await getProgress()).attendance[0].weekStart).toBe("2026-10-12");
    session({ phone: "+919000000735", date: "2026-10-20" });
    expect(await getProgress()).toMatchObject({ attendance: [{ weekStart: "2026-10-19" }], tests: [] });
  });

  it("wrong amounts enter review and do not mark anything paid", async () => {
    const before = (await getLedger("STU-0587")).plan.paid;
    expect(await submitMockPayment({ token: "STU-0587-3", outcome: "wrong_amount" })).toMatchObject({ ok: true, result: "checking" });
    expect((await getDues()).mode).toBe("review");
    expect((await getAutomation()).unmatchedOpen).toBe(7);
    expect((await getLedger("STU-0587")).plan.paid).toBe(before);
    expect((await getAutomation()).stopped.find((row) => row.instalmentId === "STU-0587-3")?.stoppedReason).toBe("Payment being checked");
  });

  it("approving a supplied refund snapshot withdraws the student and stops reminders", async () => {
    expect(await saveRefundDraft({ studentId: "STU-0412", withdrawalDate: "2026-11-02", reason: "Personal" })).toMatchObject({ ok: true });
    expect(await approveRefund({ refundId: "STU-0412" })).toMatchObject({ ok: true });
    expect((await getLedger("STU-0412")).student.status).toBe("withdrawn");
    expect((await getRefund("STU-0412")).calc).toMatchObject({ refund: 1898631, deadline: "2026-11-12" });
    expect((await getAutomation()).stopped.some((row) => row.studentCode === "STU-0412" && row.stoppedReason === "Withdrawn")).toBe(true);
    session({ role: "parent", phone: "+919000000412" });
    expect((await getDues()).refund).toMatchObject({ amount: 1898631, status: "approved" });
    session({ role: "accounts" });
    expect(await recordCounterPayment({ studentId: "STU-0412", amountPaise: 10000, method: "cash", receivedOn: "2026-11-02" })).toMatchObject({ ok: false, code: "withdrawn" });
    expect(await markRefundPaid({ refundId: "STU-0412" })).toMatchObject({ ok: true });
    expect(await saveRefundDraft({ studentId: "STU-0412", withdrawalDate: "2026-11-02", reason: "Other" })).toMatchObject({ ok: false, code: "read_only" });
  });

  it("blocks a refund with an open queue item and resolves a matching payment once", async () => {
    await saveRefundDraft({ studentId: "STU-0771", withdrawalDate: "2026-11-02", reason: "Personal" });
    expect(await approveRefund({ refundId: "STU-0771" })).toMatchObject({ ok: false, code: "unmatched" });
    expect(await resolveUnmatched({ id: "queue-kavya", action: "match", instalmentId: "STU-0771-3", note: "Verified demo bank reference" })).toMatchObject({ ok: true });
    expect((await getLedger("STU-0771")).instalments[2]).toMatchObject({ paid: 2900000, balance: 100000 });
    expect((await getAutomation()).unmatched.find((row) => row.id === "queue-kavya")?.status).toBe("matched");
    expect(await resolveUnmatched({ id: "queue-kavya", action: "match", instalmentId: "STU-0771-3" })).toMatchObject({ ok: false, code: "resolved" });
    expect(await resolveUnmatched({ id: "queue-unknown", action: "reject", note: "" })).toMatchObject({ ok: false, code: "note_required" });
  });

  it("false flags require a note, close the task and change accuracy without changing money", async () => {
    const before = (await getLedger("STU-0733")).plan;
    expect(await closeTask({ taskId: "task-riya", outcome: "false_flag", note: "" })).toMatchObject({ ok: false, code: "note_required" });
    expect(await closeTask({ taskId: "task-riya", outcome: "false_flag", note: "Family confirmed there is no concern." })).toMatchObject({ ok: true });
    const view = await getCounsellor();
    expect(view.open).toHaveLength(0);
    expect(view.accuracy).toEqual({ genuine: 8, total: 12 });
    expect((await getLedger("STU-0733")).plan).toEqual(before);
    expect(await ensureCallBrief({ taskId: "task-riya" })).toMatchObject({ ok: true, briefSource: "template" });
  });

  it("on 9 Nov sends Mohit's Hindi reminder and nothing to paid Ishita, without duplicates", async () => {
    await submitMockPayment({ token: "STU-0587-3", outcome: "success" });
    await setDemoDate({ date: "2026-11-09" });
    expect(await today()).toBe("2026-11-09");
    expect(await runRemindersNow()).toMatchObject({ ok: true });
    const sent = (await getAutomation()).sent.filter((row) => row.on === "2026-11-09");
    expect(sent.find((row) => row.studentCode === "STU-0219")).toMatchObject({ step: -7, language: "hi", amount: 4000000 });
    expect(sent.find((row) => row.studentCode === "STU-0219")?.body).toContain("यहाँ भुगतान करें");
    expect(sent.some((row) => row.studentCode === "STU-0587")).toBe(false);
    expect(await runRemindersNow()).toMatchObject({ ok: true, sent: 0 });
  });

  it("on 9 Nov unpaid Ishita receives step 30 and reset restores every fixture", async () => {
    const before = await getDashboard();
    await setDemoDate({ date: "2026-11-09" });
    expect(await runRemindersNow()).toMatchObject({ ok: true });
    expect((await getAutomation()).sent.some((row) => row.instalmentId === "STU-0587-3" && row.step === 30)).toBe(true);
    await closeTask({ taskId: "task-riya", outcome: "called", note: "Demo call" });
    expect(await resetDemo()).toMatchObject({ ok: true });
    expect(jar.has("proto")).toBe(false);
    expect(await today()).toBe("2026-11-02");
    expect((await getDues()).current?.balance).toBe(1500000);
    expect((await getDashboard()).totals).toEqual(before.totals);
    expect((await getCounsellor()).open).toHaveLength(1);
  });

  it("counter payments distribute oldest first and retain excess in the queue", async () => {
    const result = await recordCounterPayment({ studentId: "STU-0587", amountPaise: 5000000, method: "cash", receivedOn: "2026-11-02" });
    expect(result).toMatchObject({ ok: true, excess: 500000 });
    expect((await getLedger("STU-0587")).plan.balance).toBe(0);
    expect((await getAutomation()).unmatched.some((item) => item.reason === "excess_counter_payment" && item.amount === 500000)).toBe(true);
  });

  it("validates actions, gates prototype writes and safely ignores malformed cookies", async () => {
    expect(await recordCounterPayment({ studentId: "STU-0587", amountPaise: 1.5, method: "cash", receivedOn: "2026-11-02" })).toMatchObject({ ok: false, code: "invalid" });
    expect(await setDemoDate({ date: "2026-02-30" })).toMatchObject({ ok: false, code: "invalid" });
    expect(await getPayDetails("tampered")).toBeNull();
    jar.set("proto", "not-json");
    expect(await readProto()).toEqual({});
    vi.stubEnv("NEXT_PUBLIC_PROTO", "0");
    expect(await submitMockPayment({ token: "STU-0587-3", outcome: "success" })).toMatchObject({ ok: false, code: "disabled" });
  });

  it("refuses cross-family, cross-role and cross-centre fixture access", async () => {
    session({ role: "parent", phone: "+919000000587" });
    await expect(getDues("STU-0412")).rejects.toThrow("family");
    await expect(getCounsellor()).rejects.toThrow("another role");
    expect(await approveRefund({ refundId: "STU-0412" })).toMatchObject({ ok: false, code: "forbidden" });
    session({ role: "accounts", centreId: "MLV" });
    const dashboard = await getDashboard();
    expect(dashboard.canPickCentre).toBe(false);
    expect(dashboard.rows.map((row) => row.id)).toEqual(["MLV"]);
    await expect(getLedger("STU-1013")).rejects.toThrow("centre");
    await expect(getCounsellor()).rejects.toThrow("another role");
    session({ role: "counsellor" });
    await expect(getLedger("STU-0587")).rejects.toThrow("another role");
  });

  it("keeps fixture consent and role preparation separate from real sign-in", async () => {
    session({ role: "parent", phone: "+919000000777", otp: { attempts: 0, sends: 1, verified: true } });
    expect(await grantConsent({ studentIds: ["STU-0771", "STU-0772"], wordingVersion: "v1" })).toMatchObject({ ok: true });
    expect((await getDues()).children).toHaveLength(2);
    await logout();
    expect(await openPrototypeRoute({ key: "dashboard", state: "normal" })).toMatchObject({ ok: true, next: "/staff/dashboard" });
    expect((await readProto()).role).toBe("accounts");
  });

  it("returns a clear cookie-cap error without losing existing state", async () => {
    session({ outcomes: { "old-task": { outcome: "called", note: "अ".repeat(300) } } });
    const before = jar.get("proto");
    expect(await closeTask({ taskId: "task-riya", outcome: "false_flag", note: "अ".repeat(300) })).toMatchObject({ ok: false, code: "demo_full" });
    expect(jar.get("proto")).toBe(before);
  });

  it("supports the local HTTP phone preview and uses Secure cookies on HTTPS", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "http://192.168.1.10:3000");
    await openPrototypeRoute({ key: "dues", state: "normal" });
    expect(cookieWrites.at(-1)).toEqual({ name: "proto", secure: false });
    vi.stubEnv("APP_URL", "https://demo.example.test");
    await openPrototypeRoute({ key: "dues", state: "normal" });
    expect(cookieWrites.at(-1)).toEqual({ name: "proto", secure: true });
  });

  it("reads payment results from recorded attempts and gates the private receipt", async () => {
    const paid = await submitMockPayment({ token: "STU-0587-3", outcome: "success" });
    if (!paid.ok) throw new Error("Expected a successful simulated payment");
    expect(await getPaymentResult("STU-0587-3", "paid")).toBeNull();
    expect(await getPaymentResult("STU-0219-3", paid.eventId)).toBeNull();
    expect(await getPaymentResult("STU-0587-3", paid.eventId)).toMatchObject({ result: "paid", amount: 1500000, canViewReceipt: false });
    session({ role: "parent", phone: "+919000000587", consent: true });
    expect(await getPaymentResult("STU-0587-3", paid.eventId)).toMatchObject({ canViewReceipt: true });
    session({ phone: "+919000000412" });
    expect(await getPaymentResult("STU-0587-3", paid.eventId)).toMatchObject({ canViewReceipt: false });
  });
});
