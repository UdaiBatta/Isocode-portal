import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
const { jar, writeCookie, fetcher } = vi.hoisted(() => ({ jar: new Map<string, string>(), writeCookie: vi.fn(), fetcher: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => jar.has(key) ? { value: jar.get(key)! } : undefined, set: (key: string, value: string, options?: { maxAge?: number }) => { writeCookie(key, value, options); if (options?.maxAge === 0) jar.delete(key); else jar.set(key, value); }, delete: (key: string) => jar.delete(key) }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import { requestOtp, verifyOtp, staffLogin, setLanguage, logout } from "@/lib/actions/auth";
import { getAuthState, getParentPageContext, safeParentNext } from "@/lib/data/auth";
import { getStaffPageContext } from "@/lib/data/staff";
import { backend } from "@/lib/backend";
import { submitMockPayment, recordCounterPayment } from "@/lib/actions/payments";
import { getPayDetails, getPaymentResult } from "@/lib/data/payments";
import { getInvoices, getReceipt, getReceipts } from "@/lib/data/receipts";
import { getDues } from "@/lib/data/dues";
import { getLedger } from "@/lib/data/ledger";

beforeEach(() => { jar.clear(); vi.clearAllMocks(); vi.stubGlobal("fetch", fetcher); vi.stubEnv("NEXT_PUBLIC_PROTO", "1"); vi.stubEnv("DEMO_MODE", "true"); vi.stubEnv("BACKEND_URL", "http://localhost:8000"); vi.stubEnv("INTERNAL_API_SECRET", "test-internal-key"); vi.stubEnv("APP_URL", "http://localhost:3000"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const phone = "+919000000587";
function response(body: object, status = 200, session?: string) {
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", "unrelated=ignored; Path=/");
  if (session) headers.append("Set-Cookie", session);
  return new Response(JSON.stringify(body), { status, headers });
}

it("forwards real OTP responses with the internal key and no browser session mutation", async () => {
  fetcher.mockResolvedValueOnce(response({ ok: true, phone, demoCode: "654321" }));
  expect(await requestOtp({ phone })).toEqual({ ok: true, phone, demoCode: "654321" });
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toBe("http://localhost:8000/api/request_otp");
  expect(options).toMatchObject({ method: "POST", cache: "no-store", headers: { "X-Internal-Key": "test-internal-key", "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
  expect(writeCookie).not.toHaveBeenCalled();
  fetcher.mockResolvedValueOnce(response({ ok: true, phone }));
  expect(await requestOtp({ phone })).not.toHaveProperty("demoCode");
});

it("copies Django sid with its expiry and local HTTP or HTTPS security", async () => {
  fetcher.mockResolvedValueOnce(response({ ok: true, verified: true, next: "/consent" }, 200, "sid=parent-session; Max-Age=2592000; HttpOnly; SameSite=Lax"));
  expect(await verifyOtp({ phone, code: "654321" })).toMatchObject({ ok: true, next: "/consent" });
  expect(writeCookie).toHaveBeenLastCalledWith("sid", "parent-session", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 2592000, secure: false });
  vi.stubEnv("APP_URL", "https://demo.example");
  fetcher.mockResolvedValueOnce(response({ ok: true, next: "/staff/dashboard" }, 200, "sid=staff-session; Max-Age=43200; HttpOnly"));
  await staffLogin({ email: "accounts@demo.test", password: "test-password" });
  expect(writeCookie).toHaveBeenLastCalledWith("sid", "staff-session", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 43200, secure: true });
  expect(fetcher.mock.calls[1][1].headers.Cookie).toBe("sid=parent-session");
});

it("keeps invalid credentials as an action error and clears sid on logout", async () => {
  fetcher.mockResolvedValueOnce(response({ ok: false, code: "credentials", message: "Incorrect credentials." }, 401));
  expect(await staffLogin({ email: "accounts@demo.test", password: "wrong" })).toMatchObject({ ok: false, code: "credentials" });
  expect(writeCookie).not.toHaveBeenCalled();
  jar.set("sid", "staff-session")
  fetcher.mockResolvedValueOnce(response({ ok: true, next: "/login" }, 200, "sid=; Max-Age=0; HttpOnly"));
  expect(await logout()).toEqual({ ok: true, next: "/login" });
  expect(fetcher.mock.calls[1][1].headers.Cookie).toBe("sid=staff-session");
  expect(jar.has("sid")).toBe(false);
  expect(writeCookie).toHaveBeenLastCalledWith("sid", "", expect.objectContaining({ httpOnly: true, sameSite: "lax", maxAge: 0, secure: false }));
});

it("loads receipt summaries, invoice rows and receipt detail from Django for a real session", async () => {
  jar.set("sid", "parent-session");
  const receiptId = "550e8400-e29b-41d4-a716-446655440000";
  const summary = { id: receiptId, number: "MLV/2026-27/000001", issuedOn: "2026-10-10", amount: 1500000 };
  const invoice = { ...summary, method: "upi", status: "paid" as const, href: `/receipts/${receiptId}` };
  fetcher.mockResolvedValueOnce(response({ ok: true, selectedStudentId: "STU-0587", receipts: [summary], invoices: [invoice] }));
  expect(await getReceipts("STU-0587")).toEqual([summary]);
  expect(fetcher.mock.calls[0][0]).toBe("http://localhost:8000/api/receipts?student=STU-0587");

  fetcher.mockResolvedValueOnce(response({ ok: true, invoices: [invoice] }));
  expect(await getInvoices()).toEqual([invoice]);
  expect(fetcher.mock.calls[1][0]).toBe("http://localhost:8000/api/receipts");

  const receipt = { ...summary, taxable: 1271186, cgst: 114407, sgst: 114407,
    student: { code: "STU-0587", name: "Ishita Sharma", batch: "JEE 2027 Evening", centre: "Malviya Nagar" }, method: "upi" };
  fetcher.mockResolvedValueOnce(response({ ok: true, receipt }));
  expect(await getReceipt(receiptId)).toEqual(receipt);
  expect(fetcher.mock.calls[2][0]).toBe(`http://localhost:8000/api/receipt?id=${receiptId}`);
  expect(fetcher.mock.calls.every(([, options]) => options.headers["X-Internal-Key"] === "test-internal-key")).toBe(true);
});

it("records counter payments through the accounts API with integer paise", async () => {
  jar.set("sid", "accounts-session");
  fetcher.mockResolvedValueOnce(response({ ok: true, receiptId: "receipt-id", receiptNumber: "MLV/2026-27/000002", excess: 0 }));
  expect(await recordCounterPayment({ studentId: "STU-0587", amountPaise: 5000000, method: "cash", receivedOn: "2026-11-02", note: "Front desk" })).toMatchObject({ ok: true, receiptNumber: "MLV/2026-27/000002", excess: 0 });
  expect(fetcher.mock.calls[0][0]).toBe("http://localhost:8000/api/counter_payment");
  expect(fetcher.mock.calls[0][1]).toMatchObject({
    method: "POST", headers: { "X-Internal-Key": "test-internal-key", Cookie: "sid=accounts-session" },
    body: JSON.stringify({ student: "STU-0587", amount_paise: 5000000, method: "cash", received_on: "2026-11-02", note: "Front desk" }),
  });
});

it("uses the current Django identity and children", async () => {
  jar.set("sid", "parent-session")
  const me = { ok: true, role: "parent", phone: "+919876543210", centreId: null, consent: false, declined: false, children: [{ id: "STU-2222", name: "Demo child" }] };
  fetcher.mockImplementation(async () => response(me));
  expect(await getAuthState()).toMatchObject(me);
  me.consent = true;
  expect(writeCookie).not.toHaveBeenCalled();
});

it("renders login context signed out for stale sid while protected reads still redirect", async () => {
  jar.set("sid", "expired")
  fetcher.mockImplementation(async (url: string) => url.endsWith("/public_context") ? response({ ok: true, today: "2026-11-02", demo: true }) : response({ ok: false, code: "unauthenticated", message: "Sign in." }, 401));
  expect(await getParentPageContext()).toMatchObject({ role: null, phone: null, consent: false, children: [], today: "2026-11-02" });
  await expect(getDues()).rejects.toThrow("redirect:/login");
  await expect(getStaffPageContext()).rejects.toThrow("redirect:/staff/login");
  fetcher.mockResolvedValueOnce(response({ ok: false, code: "consent_required", message: "Consent required." }, 403));
  await expect(backend("dues")).rejects.toThrow("redirect:/consent");
});

it("loads signed payment details and results through Django", async () => {
  const token = "signed-token.value";
  fetcher.mockResolvedValueOnce(response({ ok: true, valid: true, firstName: "Ishita", seq: 3, amount: 1500000, dueDate: "2026-10-10", paid: false, payUrl: `/mock-gateway/${token}` }));
  expect(await getPayDetails(token)).toMatchObject({ firstName: "Ishita", amount: 1500000, paid: false });
  expect(fetcher.mock.calls[0][0]).toBe(`http://localhost:8000/api/pay_details?token=${encodeURIComponent(token)}`);
  expect(fetcher.mock.calls[0][1].headers["X-Internal-Key"]).toBe("test-internal-key");

  fetcher.mockResolvedValueOnce(response({ ok: true, found: true, result: "paid", receiptId: "receipt-1", firstName: "Ishita", studentCode: "STU-0587", seq: 3, amount: 1500000, method: "upi", on: "2026-11-02", reference: "TXN-1", receiptNumber: "MLV/2026-27/000001", parentCanAccess: false, canViewReceipt: false }));
  expect(await getPaymentResult(token, "gateway-event-1")).toMatchObject({ result: "paid", method: "upi", studentCode: "STU-0587", canViewReceipt: false });
  expect(fetcher.mock.calls[1][0]).toContain("/api/payment_result?token=");
  expect(fetcher.mock.calls[1][0]).toContain("eventId=gateway-event-1");
});

it("signs a mock gateway payload from authoritative Django payment details", async () => {
  const token = "signed-token.value";
  const secret = "test-webhook-secret";
  vi.stubEnv("PAYMENT_WEBHOOK_SECRET", secret);
  fetcher.mockResolvedValueOnce(response({ ok: true, valid: true, reference: "instalment-1", amount: 1500000, today: "2026-11-02", paid: false }));
  fetcher.mockResolvedValueOnce(response({ ok: true, eventId: "gateway-event-1", result: "queued" }));
  expect(await submitMockPayment({ token, outcome: "wrong_amount", method: "netbanking" })).toMatchObject({ ok: true, eventId: "gateway-event-1", result: "checking" });
  const [url, options] = fetcher.mock.calls[1];
  expect(url).toBe("http://localhost:8000/api/webhooks/payment");
  const payload = JSON.parse(options.body);
  expect(payload).toMatchObject({ reference: "instalment-1", amount_paise: 1400000, status: "success", paid_on: "2026-11-02", method: "netbanking" });
  expect(options.headers).toEqual({ "Content-Type": "application/json", "X-Signature": createHmac("sha256", secret).update(options.body).digest("hex") });
  expect(options.headers).not.toHaveProperty("X-Internal-Key");
});

it("loads a real staff ledger through Django and sends stale sessions to staff sign-in", async () => {
  jar.set("sid", "staff-session");
  const ledger = {
    student: { id: "student-id", code: "STU-0412", name: "Aarav Meena", batch: "JEE 2027 Morning", centre: "Malviya Nagar", status: "active" },
    plan: { gross: 12000000, discount: 0, discountReason: null, net: 12000000, paid: 9000000, balance: 3000000 },
    instalments: [], payments: [], timeline: [], refund: null, guardianPhone: "+919000000412",
  };
  fetcher.mockResolvedValueOnce(response({ ok: true, ...ledger }));
  expect(await getLedger("STU-0412")).toMatchObject({ student: { code: "STU-0412" }, plan: { paid: 9000000 } });
  expect(fetcher.mock.calls[0][0]).toBe("http://localhost:8000/api/ledger?student=STU-0412");
  expect(fetcher.mock.calls[0][1].headers.Cookie).toBe("sid=staff-session");

  fetcher.mockResolvedValueOnce(response({ ok: false, code: "unauthenticated", message: "Sign in." }, 401));
  await expect(getLedger("STU-0412")).rejects.toThrow("redirect:/staff/login");
});

it("sets language through Django even when prototype mode is disabled", async () => {
  vi.stubEnv("NEXT_PUBLIC_PROTO", "0");
  fetcher.mockResolvedValueOnce(response({ ok: true, language: "hi" }));
  expect(await setLanguage({ language: "hi" })).toEqual({ ok: true, language: "hi" });
  expect(fetcher.mock.calls[0][0]).toBe("http://localhost:8000/api/set_language");
  expect(jar.get("lang")).toBe("hi");
  expect(writeCookie).toHaveBeenLastCalledWith("lang", "hi", expect.objectContaining({ secure: false }));
  vi.stubEnv("APP_URL", "https://demo.example");
  fetcher.mockResolvedValueOnce(response({ ok: true, language: "en" }));
  await setLanguage({ language: "en" });
  expect(writeCookie).toHaveBeenLastCalledWith("lang", "en", expect.objectContaining({ secure: true }));
});

it("permits only an internal receipt return target", () => {
  expect(safeParentNext("/receipts/demo-receipt-1")).toBe("/receipts/demo-receipt-1");
  for (const target of ["https://example.com", "//example.com", "/staff/dashboard", "/receipts/../staff"]) expect(safeParentNext(target)).toBe("/dashboard");
});
