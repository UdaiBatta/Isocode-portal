import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { fetcher } = vi.hoisted(() => ({ fetcher: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => key === "sid" ? { value: "parent-session" } : undefined }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import { getFamily, getStudentInfo } from "@/lib/data/student";
import { getProgress } from "@/lib/data/progress";

beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("fetch", fetcher);
  vi.stubEnv("BACKEND_URL", "http://localhost:8000"); vi.stubEnv("INTERNAL_API_SECRET", "test-key");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("uses current Django family, identity and academic reads for real sessions", async () => {
  const family = { ok: true, selected: "STU-0001", family: [{ studentId: "STU-0001", fullName: "Fictional database child" }] };
  fetcher.mockResolvedValueOnce(Response.json(family));
  expect(await getFamily()).toEqual(family);
  const info = { ok: true, code: "STU-0001", name: "Fictional database child" };
  fetcher.mockResolvedValueOnce(Response.json(info));
  expect(await getStudentInfo("STU-0001")).toEqual(info);
  const progress = { ok: true, attendance: [{ weekStart: "2026-10-26", attended: 5, held: 6 }], tests: [] };
  fetcher.mockResolvedValueOnce(Response.json(progress));
  expect(await getProgress("STU-0001")).toEqual(progress);
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    "http://localhost:8000/api/family", "http://localhost:8000/api/student_info?student=STU-0001", "http://localhost:8000/api/progress?student=STU-0001",
  ]);
  expect(fetcher.mock.calls.every(([, options]) => options.headers.Cookie === "sid=parent-session")).toBe(true);
});

it("enforces consent, scope and expired-session handling without fixture fallback", async () => {
  fetcher.mockResolvedValueOnce(Response.json({ ok: false, code: "consent_required", message: "Consent required." }, { status: 403 }));
  await expect(getFamily()).rejects.toThrow("redirect:/consent");
  fetcher.mockResolvedValueOnce(Response.json({ ok: false, code: "forbidden", message: "Outside your family." }, { status: 403 }));
  await expect(getProgress("STU-9999")).rejects.toThrow("Outside your family.");
  fetcher.mockResolvedValueOnce(Response.json({ ok: false, code: "unauthenticated", message: "Sign in." }, { status: 401 }));
  await expect(getStudentInfo()).rejects.toThrow("redirect:/login");
});
