import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { jar, fetcher } = vi.hoisted(() => ({ jar: new Map<string, string>(), fetcher: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => jar.has(key) ? { value: jar.get(key)! } : undefined }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import { getLocalizedRefundPolicy, getRefund } from "@/lib/data/refund";
import { approveRefund, markRefundPaid, previewRefund, saveRefundDraft } from "@/lib/actions/refund";

beforeEach(() => {
  jar.clear(); vi.clearAllMocks(); jar.set("sid", "accounts-session");
  vi.stubGlobal("fetch", fetcher);
  vi.stubEnv("BACKEND_URL", "http://localhost:8000"); vi.stubEnv("INTERNAL_API_SECRET", "test-internal-key");
  vi.stubEnv("NEXT_PUBLIC_PROTO", "1"); vi.stubEnv("DEMO_MODE", "true");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("reads and previews a real refund through Django", async () => {
  const view = { ok: true, student: { code: "STU-0412", name: "Synthetic student" }, policy: { version: "v1" },
    input: { withdrawalDate: "2026-11-02", reason: null }, status: "new", calc: { refund: 1898631 }, blockedBy: null, overdueDeadline: false };
  fetcher.mockResolvedValueOnce(Response.json(view));
  expect(await getRefund("STU-0412")).toEqual(view);
  expect(fetcher.mock.calls[0][0]).toBe("http://localhost:8000/api/refund?student=STU-0412");
  fetcher.mockResolvedValueOnce(Response.json(view));
  expect(await previewRefund({ studentId: "STU-0412", withdrawalDate: "2026-10-01" })).toEqual(view);
  expect(fetcher.mock.calls[1][0]).toBe("http://localhost:8000/api/refund?student=STU-0412&withdrawalDate=2026-10-01");
  expect(fetcher.mock.calls[1][1]).toMatchObject({ method: "GET", headers: { Cookie: "sid=accounts-session" } });
});

it("forwards real draft, approval and paid actions using the existing student-code identifier", async () => {
  const input = { studentId: "STU-0412", withdrawalDate: "2026-11-02", reason: "Moved city" };
  fetcher.mockResolvedValueOnce(Response.json({ ok: true, refundId: "STU-0412" }));
  expect(await saveRefundDraft(input)).toEqual({ ok: true, refundId: "STU-0412" });
  fetcher.mockResolvedValueOnce(Response.json({ ok: true, refundId: "STU-0412" }));
  expect(await approveRefund({ refundId: "STU-0412" })).toMatchObject({ ok: true });
  fetcher.mockResolvedValueOnce(Response.json({ ok: true, refundId: "STU-0412", paidOn: "2026-11-02" }));
  expect(await markRefundPaid({ refundId: "STU-0412" })).toMatchObject({ ok: true, paidOn: "2026-11-02" });
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    "http://localhost:8000/api/save_refund_draft", "http://localhost:8000/api/approve_refund", "http://localhost:8000/api/mark_refund_paid",
  ]);
  expect(fetcher.mock.calls[0][1].body).toBe(JSON.stringify(input));
  expect(fetcher.mock.calls.every(([, options]) => options.headers.Cookie === "sid=accounts-session")).toBe(true);
});

it("preserves Django's queue denial and expired-session handling without a fixture fallback", async () => {
  fetcher.mockResolvedValueOnce(Response.json({ ok: false, code: "unmatched", message: "Resolve the open payment." }, { status: 409 }));
  expect(await approveRefund({ refundId: "STU-0412" })).toMatchObject({ ok: false, code: "unmatched" });
  fetcher.mockResolvedValueOnce(Response.json({ ok: false, code: "unauthenticated", message: "Sign in." }, { status: 401 }));
  await expect(getRefund("STU-0412")).rejects.toThrow("redirect:/staff/login");
});

it("loads the public policy from Django in either language without a session", async () => {
  jar.clear(); jar.set("lang", "en");
  const policy = { ok: true, version: "v2", textEn: "Synthetic English policy", textHi: "काल्पनिक नीति" };
  fetcher.mockResolvedValueOnce(Response.json(policy));
  expect(await getLocalizedRefundPolicy()).toEqual({ version: "v2", text: policy.textEn });
  jar.set("lang", "hi"); fetcher.mockResolvedValueOnce(Response.json(policy));
  expect(await getLocalizedRefundPolicy()).toEqual({ version: "v2", text: policy.textHi });
  expect(fetcher.mock.calls.every(([url]) => url === "http://localhost:8000/api/refund_policy")).toBe(true);
});
