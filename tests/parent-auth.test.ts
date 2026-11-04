import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => jar.has(key) ? { value: jar.get(key)! } : undefined, set: (key: string, value: string) => jar.set(key, value), delete: (key: string) => jar.delete(key) }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { requestOtp, verifyOtp, grantConsent, declineConsent, logout } from "@/lib/actions/auth";
import { safeParentNext } from "@/lib/data/auth";

beforeEach(() => { jar.clear(); vi.stubEnv("NEXT_PUBLIC_PROTO", "1"); vi.useFakeTimers(); vi.setSystemTime("2026-11-03T06:00:00Z"); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
const phone = "+919000000587";

it("enforces the resend cooldown and three sends per ten minutes", async () => {
  expect(await requestOtp({ phone })).toMatchObject({ ok: true });
  expect(await requestOtp({ phone })).toMatchObject({ ok: false, code: "cooldown" });
  for (let i = 0; i < 2; i++) { vi.advanceTimersByTime(30000); expect(await requestOtp({ phone })).toMatchObject({ ok: true }); }
  vi.advanceTimersByTime(30000);
  expect(await requestOtp({ phone })).toMatchObject({ ok: false, code: "too_many" });
  vi.advanceTimersByTime(600000);
  expect(await requestOtp({ phone })).toMatchObject({ ok: true });
});

it("expires a challenge and limits wrong-code attempts", async () => {
  await requestOtp({ phone }); vi.advanceTimersByTime(300000);
  expect(await verifyOtp({ phone, code: "123456" })).toMatchObject({ ok: false, code: "expired" });
  await requestOtp({ phone });
  for (let i = 0; i < 5; i++) expect(await verifyOtp({ phone, code: "000000" })).toMatchObject({ ok: false, code: "code_wrong" });
  expect(await verifyOtp({ phone, code: "123456" })).toMatchObject({ ok: false, code: "too_many" });
});

it("keeps consent on a returning parent's login and remembers a declined choice", async () => {
  await requestOtp({ phone }); await verifyOtp({ phone, code: "123456" });
  await declineConsent();
  expect(JSON.parse(jar.get("proto")!).declined).toBe(true);
  await grantConsent({ studentIds: ["STU-0587"], wordingVersion: "v1" });
  await logout(); await requestOtp({ phone });
  expect(await verifyOtp({ phone, code: "123456" })).toMatchObject({ ok: true, next: "/dashboard" });
});

it("permits only an internal receipt return target", () => {
  expect(safeParentNext("/receipts/demo-receipt-1")).toBe("/receipts/demo-receipt-1");
  for (const target of ["https://example.com", "//example.com", "/staff/dashboard", "/receipts/../staff"]) expect(safeParentNext(target)).toBe("/dashboard");
});
