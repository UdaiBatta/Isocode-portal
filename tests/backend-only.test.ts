import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { jar, fetcher, setCookie } = vi.hoisted(() => ({ jar: new Map<string, string>(), fetcher: vi.fn(), setCookie: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => jar.has(key) ? { value: jar.get(key)! } : undefined, set: setCookie }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { getAuthState } from "@/lib/data/auth";
import { getDues } from "@/lib/data/dues";
import { getAdminStudents } from "@/lib/data/admin";
import { getPayDetails } from "@/lib/data/payments";
import { grantConsent, declineConsent } from "@/lib/actions/auth";
import { submitMockPayment } from "@/lib/actions/payments";

beforeEach(() => {
  jar.clear(); vi.resetAllMocks(); vi.stubGlobal("fetch", fetcher);
  vi.stubEnv("BACKEND_URL", "http://localhost:8000"); vi.stubEnv("INTERNAL_API_SECRET", "test-key");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("gets the anonymous business date from Django and refuses unsigned private reads", async () => {
  fetcher.mockImplementation(async (url: string) => url.endsWith("/public_context")
    ? Response.json({ ok: true, today: "2026-11-09", demo: true })
    : Response.json({ ok: false, code: "unauthenticated", message: "Sign in." }, { status: 401 }));
  expect(await getAuthState()).toMatchObject({ role: null, today: "2026-11-09", children: [] });
  await expect(getDues()).rejects.toThrow("redirect:/login");
  await expect(getAdminStudents()).rejects.toThrow("redirect:/staff/login");
  expect(setCookie).not.toHaveBeenCalled();
});

it("forwards consent with the displayed language and never simulates a saved consent", async () => {
  jar.set("sid", "parent-session"); jar.set("lang", "en");
  fetcher.mockResolvedValueOnce(Response.json({ ok: true, next: "/dashboard" }));
  expect(await grantConsent({ studentIds: ["STU-0587"], wordingVersion: "v1", language: "hi" })).toMatchObject({ ok: true });
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ studentIds: ["STU-0587"], wordingVersion: "v1", language: "en" });
  jar.clear();
  fetcher.mockResolvedValueOnce(Response.json({ ok: false, code: "unauthenticated", message: "Sign in." }, { status: 401 }));
  expect(await declineConsent()).toMatchObject({ ok: false, code: "unauthenticated" });
  expect(setCookie).not.toHaveBeenCalled();
});

it("sends old sample payment URLs to Django instead of recording fake money", async () => {
  vi.stubEnv("PAYMENT_WEBHOOK_SECRET", "test-webhook-secret");
  fetcher.mockImplementation(async () => Response.json({ ok: true, valid: false }));
  expect(await getPayDetails("STU-0587-3")).toBeNull();
  expect(await submitMockPayment({ token: "STU-0587-3", outcome: "success" })).toMatchObject({ ok: false, code: "invalid_link" });
  expect(fetcher.mock.calls.every(([url]) => url === "http://localhost:8000/api/pay_details?token=STU-0587-3")).toBe(true);
  expect(setCookie).not.toHaveBeenCalled();
});
