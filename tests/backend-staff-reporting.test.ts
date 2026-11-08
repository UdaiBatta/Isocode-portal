import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { jar, fetcher } = vi.hoisted(() => ({ jar: new Map<string, string>(), fetcher: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => jar.has(key) ? { value: jar.get(key)! } : undefined }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import { getDashboard } from "@/lib/data/dashboard";
import { getStudents } from "@/lib/data/students";
import { getStaffDirectory } from "@/lib/data/staff";

beforeEach(() => {
  jar.clear(); vi.clearAllMocks(); jar.set("sid", "staff-session");
  vi.stubGlobal("fetch", fetcher);
  vi.stubEnv("BACKEND_URL", "http://localhost:8000"); vi.stubEnv("INTERNAL_API_SECRET", "test-key");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("forwards real dashboard and roster filters to Django without reading fixtures", async () => {
  const view = { ok: true, today: "2026-11-02", rows: [], totals: { outstanding: 12345 } };
  fetcher.mockResolvedValueOnce(Response.json(view));
  expect(await getDashboard({ group: "batch", centre: "MLV", batch: "example-uuid" })).toEqual(view);
  fetcher.mockResolvedValueOnce(Response.json(view));
  expect(await getStudents({ status: "over60", centre: "MLV", q: "A & B", page: 2 })).toEqual(view);
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    "http://localhost:8000/api/dashboard?group=batch&centre=MLV&batch=example-uuid",
    "http://localhost:8000/api/students?status=over60&centre=MLV&q=A+%26+B&page=2",
  ]);
  expect(fetcher.mock.calls.every(([, options]) => options.headers.Cookie === "sid=staff-session")).toBe(true);
});

it("uses the real scoped directory and redirects expired sessions", async () => {
  const directory = { ok: true, centres: [{ id: "MLV", name: "Synthetic centre" }], batches: [] };
  fetcher.mockResolvedValueOnce(Response.json(directory));
  expect(await getStaffDirectory()).toEqual(directory);
  expect(fetcher.mock.calls[0][0]).toBe("http://localhost:8000/api/staff_directory");
  fetcher.mockResolvedValueOnce(Response.json({ ok: false, code: "unauthenticated", message: "Sign in." }, { status: 401 }));
  await expect(getStudents()).rejects.toThrow("redirect:/staff/login");
});
