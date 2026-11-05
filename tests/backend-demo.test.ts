import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { jar, fetcher } = vi.hoisted(() => ({ jar: new Map<string, string>(), fetcher: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => jar.has(key) ? { value: jar.get(key)! } : undefined }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import { resetDemo, runRemindersNow, setDemoDate } from "@/lib/actions/demo";
import { getParentPageContext } from "@/lib/data/auth";
import { getStaffPageContext } from "@/lib/data/staff";

beforeEach(() => {
  jar.clear(); vi.clearAllMocks(); jar.set("sid", "real-session");
  vi.stubGlobal("fetch", fetcher);
  vi.stubEnv("BACKEND_URL", "http://localhost:8000"); vi.stubEnv("INTERNAL_API_SECRET", "test-internal-key");
  vi.stubEnv("NEXT_PUBLIC_PROTO", "1"); vi.stubEnv("DEMO_MODE", "true");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("forwards real demo actions without mutating a prototype cookie", async () => {
  fetcher.mockResolvedValueOnce(Response.json({ ok: true, date: "2026-11-09" }));
  expect(await setDemoDate({ date: "2026-11-09" })).toEqual({ ok: true, date: "2026-11-09" });
  fetcher.mockResolvedValueOnce(Response.json({ ok: true, sent: 2, skipped: 4 }));
  expect(await runRemindersNow()).toEqual({ ok: true, sent: 2, skipped: 4 });
  fetcher.mockResolvedValueOnce(Response.json({ ok: true, reset: true, date: "2026-11-02" }));
  expect(await resetDemo()).toEqual({ ok: true, reset: true, date: "2026-11-02" });
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    "http://localhost:8000/api/set_demo_date", "http://localhost:8000/api/run_reminders_now", "http://localhost:8000/api/reset_demo",
  ]);
  expect(fetcher.mock.calls.map(([, options]) => options.body)).toEqual([JSON.stringify({ date: "2026-11-09" }), "{}", "{}"]);
  expect(fetcher.mock.calls.every(([, options]) => options.headers.Cookie === "sid=real-session")).toBe(true);
});

it("returns Django's demo-mode denial instead of resetting fixtures", async () => {
  fetcher.mockResolvedValueOnce(Response.json({ ok: false, code: "demo_only", message: "Demo controls are unavailable." }, { status: 403 }));
  expect(await resetDemo()).toMatchObject({ ok: false, code: "demo_only" });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("uses Django's date for real staff and parent page contexts", async () => {
  const session = { ok: true, role: "accounts", phone: null, centreId: null, children: [], consent: false, declined: false, today: "2026-11-09" };
  fetcher.mockImplementation(async () => Response.json(session));
  expect(await getStaffPageContext()).toMatchObject({ role: "accounts", today: "2026-11-09" });
  session.role = "parent";
  expect(await getParentPageContext()).toMatchObject({ role: "parent", today: "2026-11-09" });
});
