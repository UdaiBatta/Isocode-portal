import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { fetcher } = vi.hoisted(() => ({ fetcher: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => key === "sid" ? { value: "accounts-session" } : undefined }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import { getExport } from "@/lib/data/exports";

beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("fetch", fetcher);
  vi.stubEnv("BACKEND_URL", "http://localhost:8000"); vi.stubEnv("INTERNAL_API_SECRET", "test-key");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("forwards real CSV text, filename and filters through getExport", async () => {
  const text = "Student code,Name,Balance paise\r\nSTU-0587,Synthetic student,1500000\r\n";
  fetcher.mockResolvedValueOnce(new Response(text, { headers: { "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": 'attachment; filename="dues-2026-11-02.csv"' } }));
  expect(await getExport("dues", { centre: "MLV", batch: "example-uuid" })).toEqual({ filename: "dues-2026-11-02.csv", text });
  expect(fetcher.mock.calls[0][0]).toBe("http://localhost:8000/api/export/dues.csv?centre=MLV&batch=example-uuid");
  expect(fetcher.mock.calls[0][1].headers.Cookie).toBe("sid=accounts-session");
  expect(fetcher.mock.calls[0][1].headers["X-Internal-Key"]).toBe("test-key");
  expect(fetcher.mock.calls[0][1].cache).toBe("no-store");
});

it("forwards Tally XML, encoded filters and its filename", async () => {
  const text = "<ENVELOPE />";
  fetcher.mockResolvedValueOnce(new Response(text, { headers: { "Content-Type": "text/xml; charset=utf-8",
    "Content-Disposition": 'attachment; filename="tally-receipts-2026-11.xml"' } }));
  expect(await getExport("tally", { centre: "A&B" })).toEqual({ filename: "tally-receipts-2026-11.xml", text });
  expect(fetcher.mock.calls[0][0]).toBe("http://localhost:8000/api/export/tally.xml?centre=A%26B");
});

it("preserves access failures and refuses unexpected CSV responses", async () => {
  fetcher.mockResolvedValueOnce(Response.json({ ok: false, code: "forbidden", message: "Accounts only." }, { status: 403 }));
  await expect(getExport("receipts")).rejects.toThrow("Accounts only.");
  fetcher.mockResolvedValueOnce(Response.json({ ok: false, code: "unauthenticated", message: "Sign in." }, { status: 401 }));
  await expect(getExport("dues")).rejects.toThrow("redirect:/staff/login");
  fetcher.mockResolvedValueOnce(new Response("<html>failure</html>", { headers: { "Content-Type": "text/html" } }));
  await expect(getExport("dues")).rejects.toThrow("Unexpected export response.");
  fetcher.mockResolvedValueOnce(new Response("<ENVELOPE />", { headers: { "Content-Type": "text/csv",
    "Content-Disposition": 'attachment; filename="receipts-2026-11.csv"' } }));
  await expect(getExport("tally")).rejects.toThrow("Unexpected export response.");
});
