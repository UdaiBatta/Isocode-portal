import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { jar, writeCookie, fetcher } = vi.hoisted(() => ({ jar: new Map<string, string>(), writeCookie: vi.fn(), fetcher: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => jar.has(key) ? { value: jar.get(key)! } : undefined, set: (key: string, value: string, options?: { maxAge?: number }) => { writeCookie(key, value, options); if (options?.maxAge === 0) jar.delete(key); else jar.set(key, value); }, delete: (key: string) => jar.delete(key) }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import { requestOtp, verifyOtp, staffLogin, grantConsent, declineConsent, setLanguage, logout } from "@/lib/actions/auth";
import { getAuthState, getParentPageContext, safeParentNext } from "@/lib/data/auth";
import { getStaffPageContext } from "@/lib/data/staff";
import { readProto, mutatePublicPreview } from "@/lib/fixtures/state";
import { backend } from "@/lib/backend";
import { submitMockPayment, recordCounterPayment } from "@/lib/actions/payments";
import { getPayDetails, getPaymentResult } from "@/lib/data/payments";
import { getReceipt } from "@/lib/data/receipts";

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
  jar.set("sid", "staff-session"); jar.set("proto", JSON.stringify({ role: "accounts" }));
  fetcher.mockResolvedValueOnce(response({ ok: true, next: "/login" }, 200, "sid=; Max-Age=0; HttpOnly"));
  expect(await logout()).toEqual({ ok: true, next: "/login" });
  expect(fetcher.mock.calls[1][1].headers.Cookie).toBe("sid=staff-session");
  expect(jar.has("sid")).toBe(false); expect(jar.has("proto")).toBe(false);
  expect(writeCookie).toHaveBeenLastCalledWith("sid", "", expect.objectContaining({ httpOnly: true, sameSite: "lax", maxAge: 0, secure: false }));
});

it("uses Django identity and children over a forged prototype cookie whenever sid exists", async () => {
  jar.set("sid", "parent-session"); jar.set("proto", JSON.stringify({ role: "accounts", phone, centreId: "RJP", consent: true }));
  const me = { ok: true, role: "parent", phone: "+919876543210", centreId: null, consent: false, declined: false, children: [{ id: "STU-2222", name: "Demo child" }] };
  fetcher.mockImplementation(async () => response(me));
  expect(await getAuthState()).toMatchObject(me);
  expect(await readProto()).toMatchObject({ role: "parent", phone: me.phone, consent: false });
  expect((await readProto()).centreId).toBeUndefined();
  expect(writeCookie).not.toHaveBeenCalled();
});

it("renders login context signed out for stale sid while protected reads still redirect", async () => {
  jar.set("sid", "expired"); jar.set("proto", JSON.stringify({ role: "accounts" }));
  fetcher.mockImplementation(async () => response({ ok: false, code: "unauthenticated", message: "Sign in." }, 401));
  expect(await getParentPageContext()).toMatchObject({ role: null, phone: null, consent: false, children: [], today: "2026-11-02" });
  await expect(readProto()).rejects.toThrow("redirect:/login");
  await expect(getStaffPageContext()).rejects.toThrow("redirect:/staff/login");
  fetcher.mockResolvedValueOnce(response({ ok: false, code: "consent_required", message: "Consent required." }, 403));
  await expect(backend("dues")).rejects.toThrow("redirect:/consent");
});

it("keeps no-sid fixture previews and consent simulation isolated from real sessions", async () => {
  jar.set("proto", JSON.stringify({ role: "parent", phone, otp: { attempts: 0, sends: 1, verified: true } }));
  expect(await getAuthState()).toMatchObject({ role: "parent", phone });
  await declineConsent(); expect(JSON.parse(jar.get("proto")!).declined).toBe(true);
  await grantConsent({ studentIds: ["STU-0587"], wordingVersion: "v1" });
  expect(JSON.parse(jar.get("proto")!).consent).toBe(true);
  expect(fetcher).not.toHaveBeenCalled();
  jar.set("sid", "real-session");
  expect(await grantConsent({ studentIds: ["STU-0587"], wordingVersion: "v1" })).toMatchObject({ ok: false, code: "unavailable" });
});

it("completes a public payment action and recorded result with stale sid without private access", async () => {
  jar.set("proto", JSON.stringify({ role: "accounts", phone, consent: true }));
  jar.set("sid", "expired");
  fetcher.mockImplementation(async () => response({ ok: false, code: "unauthenticated", message: "Sign in." }, 401));
  expect(await getPayDetails("STU-0587-3")).toMatchObject({ firstName: "Ishita", paid: false, amount: 1500000 });
  const paid = await submitMockPayment({ token: "STU-0587-3", outcome: "success" });
  if (!paid.ok) throw new Error("Expected a recorded fixture payment");
  expect(fetcher).not.toHaveBeenCalled();
  expect(await getPayDetails("STU-0587-3")).toMatchObject({ firstName: "Ishita", paid: true, amount: 0 });
  expect(await getPaymentResult("STU-0587-3", paid.eventId)).toMatchObject({ result: "paid", amount: 1500000, parentCanAccess: false, canViewReceipt: false });
  await expect(getReceipt(paid.receiptId!)).rejects.toThrow("redirect:/login");
  await expect(recordCounterPayment({ studentId: "STU-0587", amountPaise: 100, method: "cash", receivedOn: "2026-11-02" })).rejects.toThrow("redirect:/login");
});

it("keeps public preview mutations mode-gated and bounded by the existing cookie cap", async () => {
  vi.stubEnv("NEXT_PUBLIC_PROTO", "0");
  expect(await submitMockPayment({ token: "STU-0587-3", outcome: "success" })).toMatchObject({ ok: false, code: "disabled" });
  expect(writeCookie).not.toHaveBeenCalled();
  vi.stubEnv("NEXT_PUBLIC_PROTO", "1");
  jar.set("proto", JSON.stringify({ outcomes: { previous: { outcome: "called", note: "अ".repeat(300) } } }));
  const before = jar.get("proto");
  expect(await mutatePublicPreview((state) => { state.outcomes!.extra = { outcome: "called", note: "अ".repeat(300) }; return {}; })).toMatchObject({ ok: false, code: "demo_full" });
  expect(jar.get("proto")).toBe(before);
  expect(fetcher).not.toHaveBeenCalled();
});

it("sets language through Django even when prototype mode is disabled", async () => {
  vi.stubEnv("NEXT_PUBLIC_PROTO", "0");
  fetcher.mockResolvedValueOnce(response({ ok: true, language: "hi" }));
  expect(await setLanguage({ language: "hi" })).toEqual({ ok: true, language: "hi" });
  expect(fetcher.mock.calls[0][0]).toBe("http://localhost:8000/api/set_language");
  expect(jar.get("lang")).toBe("hi");
  expect(jar.has("proto")).toBe(false);
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
