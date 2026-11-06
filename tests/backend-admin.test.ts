import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { fetcher, revalidate } = vi.hoisted(() => ({ fetcher: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => key === "sid" ? { value: "admin-session" } : undefined }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));
import { getAdminStudents, getAdminBatches, getAdminCentres, getAdminStaff, getAdminDirectory, getChangeHistory } from "@/lib/data/admin";
import { saveCentre, saveBatch, saveStaff, saveStudent, changeFee, archiveRecord, restoreRecord, deleteRecord } from "@/lib/actions/admin";

const id = "12345678-1234-4123-8123-123456789012";
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal("fetch", fetcher);
  vi.stubEnv("BACKEND_URL", "http://localhost:8000"); vi.stubEnv("INTERNAL_API_SECRET", "test-key");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("reads real Admin records, filters and audit history without prototype IDs", async () => {
  const payload = { ok: true, rows: [{ id, name: "Fictional live record" }], centres: [], batches: [] };
  fetcher.mockImplementation(async () => Response.json(payload));
  expect(await getAdminStudents({ centre: id, q: "A & B", page: 2 })).toEqual(payload);
  await getAdminBatches({ centre: id }); await getAdminCentres(); await getAdminStaff();
  await getAdminDirectory(); await getChangeHistory({ entity: "student", id });
  const paths = fetcher.mock.calls.map(([url]) => new URL(url));
  expect(paths.map((url) => url.pathname)).toEqual(["/api/admin_students", "/api/admin_batches", "/api/admin_centres", "/api/admin_staff", "/api/admin_directory", "/api/admin_history"]);
  expect(paths[0].searchParams.get("q")).toBe("A & B");
  expect(paths[0].searchParams.get("centre")).toBe(id);
  expect(paths[5].searchParams.get("id")).toBe(id);
  expect(fetcher.mock.calls.every(([, options]) => options.headers.Cookie === "sid=admin-session" && options.cache === "no-store")).toBe(true);
});

it("forwards every real write before fixture validation and refreshes only successful writes", async () => {
  fetcher.mockImplementation(async () => Response.json({ ok: true, id }));
  const input = { id, studentId: id, entity: "student", reason: "Audited reduction", gross: 100, discount: 0 };
  for (const action of [saveCentre, saveBatch, saveStaff, saveStudent, changeFee, archiveRecord, restoreRecord, deleteRecord]) {
    expect(await action(input)).toEqual({ ok: true, id });
  }
  expect(fetcher.mock.calls.map(([url]) => new URL(url).pathname)).toEqual(["/api/admin_save_centre", "/api/admin_save_batch", "/api/admin_save_staff", "/api/admin_save_student", "/api/admin_change_fee", "/api/admin_archive", "/api/admin_restore", "/api/admin_delete"]);
  expect(fetcher.mock.calls.every(([, options]) => options.method === "POST" && JSON.stringify(JSON.parse(options.body)) === JSON.stringify(input))).toBe(true);
  expect(revalidate).toHaveBeenCalledTimes(8);
  expect(revalidate).toHaveBeenLastCalledWith("/staff/manage", "layout");
  fetcher.mockResolvedValueOnce(Response.json({ ok: false, code: "below_paid", message: "Keep existing payments." }, { status: 409 }));
  expect(await changeFee(input)).toMatchObject({ ok: false, code: "below_paid" });
  expect(revalidate).toHaveBeenCalledTimes(8);
});

it("refuses forbidden and expired reads without using fixture records", async () => {
  fetcher.mockResolvedValueOnce(Response.json({ ok: false, code: "forbidden", message: "Global Admin required." }, { status: 403 }));
  await expect(getAdminStudents()).rejects.toThrow("Global Admin required.");
  fetcher.mockResolvedValueOnce(Response.json({ ok: false, code: "unauthenticated", message: "Sign in." }, { status: 401 }));
  await expect(getAdminDirectory()).rejects.toThrow("redirect:/staff/login");
});
