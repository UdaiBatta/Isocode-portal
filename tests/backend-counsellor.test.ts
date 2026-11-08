import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { fetcher } = vi.hoisted(() => ({ fetcher: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => key === "sid" ? { value: "counsellor-session" } : undefined }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import { getCounsellor } from "@/lib/data/counsellor";
import { closeTask, ensureCallBrief } from "@/lib/actions/counsellor";

beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("fetch", fetcher);
  vi.stubEnv("BACKEND_URL", "http://localhost:8000"); vi.stubEnv("INTERNAL_API_SECRET", "test-key");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("loads live counsellor data and forwards real UUID outcomes and brief requests", async () => {
  const view = { ok: true, accuracy: { genuine: 8, total: 11 }, open: [], closed: [], watch: [], unknown: [] };
  fetcher.mockResolvedValueOnce(Response.json(view));
  expect(await getCounsellor()).toEqual(view);
  const taskId = "735cd728-4585-4ddd-9827-3153317961f3";
  fetcher.mockResolvedValueOnce(Response.json({ ok: true, taskId }));
  expect(await closeTask({ taskId, outcome: "false_flag", note: "Synthetic false flag" })).toEqual({ ok: true, taskId });
  const timeout = vi.spyOn(AbortSignal, "timeout");
  fetcher.mockResolvedValueOnce(Response.json({ ok: true, brief: "Supportive standard summary.", briefSource: "template" }));
  expect(await ensureCallBrief({ taskId })).toMatchObject({ ok: true, briefSource: "template" });
  expect(timeout).toHaveBeenCalledWith(35000);
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    "http://localhost:8000/api/counsellor", "http://localhost:8000/api/close_task", "http://localhost:8000/api/ensure_call_brief",
  ]);
  expect(fetcher.mock.calls[1][1].body).toBe(JSON.stringify({ taskId, outcome: "false_flag", note: "Synthetic false flag" }));
  expect(fetcher.mock.calls.every(([, options]) => options.headers.Cookie === "sid=counsellor-session")).toBe(true);
});

it("preserves Django denials and expired-session redirects", async () => {
  fetcher.mockResolvedValueOnce(Response.json({ ok: false, code: "note_required", message: "Explain why." }, { status: 400 }));
  expect(await closeTask({ taskId: "example", outcome: "false_flag", note: "" })).toMatchObject({ ok: false, code: "note_required" });
  fetcher.mockResolvedValueOnce(Response.json({ ok: false, code: "forbidden", message: "Counsellors only." }, { status: 403 }));
  expect(await ensureCallBrief({ taskId: "example" })).toMatchObject({ ok: false, code: "forbidden" });
  fetcher.mockResolvedValueOnce(Response.json({ ok: false, code: "unauthenticated", message: "Sign in." }, { status: 401 }));
  await expect(getCounsellor()).rejects.toThrow("redirect:/staff/login");
});
