import { beforeEach, expect, it, vi } from "vitest";

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (name: string) => jar.has(name) ? { value: jar.get(name)! } : undefined,
  set: (name: string, value: string) => { jar.set(name, value); },
  delete: (name: string) => jar.delete(name),
}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { deleteRecord, saveBatch, saveStaff } from "@/lib/actions/admin";
import { manageWorld } from "@/lib/fixtures/admin";

const world = () => manageWorld(JSON.parse(jar.get("proto")!));
const ok = (result: { ok: boolean }) => { expect(result).toMatchObject({ ok: true }); return result as unknown as { id: string }; };

beforeEach(() => { jar.clear(); jar.set("proto", JSON.stringify({ role: "admin" })); vi.stubEnv("NEXT_PUBLIC_PROTO", "1"); });

it("never reuses a staff or batch ID after create, delete, create (Codex ADMIN.6)", async () => {
  const staff = (email: string) => saveStaff({ fullName: "New Person", email, role: "accounts", centreId: "MLV", password: "a-long-password-123" });
  const first = ok(await staff("first@demo.test"));
  ok(await deleteRecord({ entity: "staff", id: "STF-06" }));
  const second = ok(await staff("second@demo.test"));
  expect(second.id).not.toBe(first.id);
  expect(world().staff.filter((row) => ["first@demo.test", "second@demo.test"].includes(String(row.email)))).toHaveLength(2);

  const batch = (year: string) => saveBatch({ name: `JEE ${year} Morning`, centreId: "MLV", stream: "JEE", sessionStart: "2027-04-01", sessionEnd: "2028-03-31" });
  const early = ok(await batch("2028"));
  const kept = ok(await batch("2029"));
  ok(await deleteRecord({ entity: "batch", id: early.id }));
  const late = ok(await batch("2030"));
  expect(new Set([early.id, kept.id, late.id]).size).toBe(3);
  expect(world().batches.filter((row) => [kept.id, late.id].includes(row.id)).map((row) => row.name)).toEqual(["JEE 2029 Morning", "JEE 2030 Morning"]);
});
