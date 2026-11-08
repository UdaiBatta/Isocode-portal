import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { fetcher } = vi.hoisted(() => ({ fetcher: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => key === "sid" ? { value: "staff-session" } : undefined }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import { getStudentRecord } from "@/lib/data/ledger";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetcher);
  vi.stubEnv("BACKEND_URL", "http://localhost:8000");
  vi.stubEnv("INTERNAL_API_SECRET", "test-internal-key");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("reads real staff student records through Django without consulting fixtures", async () => {
  const record = { ok: true, info: { code: "STU-9998", name: "Synthetic database student" }, progress: { attendance: [], tests: [] } };
  fetcher.mockResolvedValueOnce(Response.json(record));
  expect(await getStudentRecord("STU-9998")).toEqual(record);
  expect(fetcher).toHaveBeenCalledWith("http://localhost:8000/api/student_record?student=STU-9998", expect.objectContaining({
    cache: "no-store", headers: { "X-Internal-Key": "test-internal-key", Cookie: "sid=staff-session" },
  }));
});

it("redirects an expired real session to staff login without falling back to fixtures", async () => {
  fetcher.mockResolvedValueOnce(Response.json({ ok: false, code: "unauthenticated", message: "Sign in." }, { status: 401 }));
  await expect(getStudentRecord("STU-0587")).rejects.toThrow("redirect:/staff/login");
});

it("preserves Django's centre denial and encodes the student query", async () => {
  fetcher.mockResolvedValueOnce(Response.json({ ok: false, code: "forbidden", message: "Student is outside your centre." }, { status: 403 }));
  await expect(getStudentRecord("STU-0587&role=admin")).rejects.toThrow("Student is outside your centre.");
  expect(fetcher.mock.calls[0][0]).toBe("http://localhost:8000/api/student_record?student=STU-0587%26role%3Dadmin");
});
