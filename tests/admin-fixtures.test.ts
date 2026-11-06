import { expect, it } from "vitest";
import { batchVMs, centreVMs, manageWorld, staffVMs, studentVMs } from "@/lib/fixtures/admin";

const on = "2026-11-02";

it("applies the board's archive and delete rules", () => {
  const world = manageWorld({});
  const batch = batchVMs(world).find((row) => row.id === "MLV-1")!;
  expect(batch.actions).toMatchObject({ canArchive: false, canDelete: false });
  expect(batch.actions.blockedReason).toMatch(/^Move its \d+ students/);
  expect(centreVMs(world).find((row) => row.id === "MLV")!.actions.canArchive).toBe(false);
  const student = studentVMs(world, {}, on).find((row) => row.code === "STU-0412")!;
  expect(student.actions.canDelete).toBe(false);
  expect(student.fee.editable).toBe(student.fee.paid < student.fee.net);
});

it("replays recorded changes into records and history", () => {
  const at = "2026-11-02T10:00:00.000Z";
  const world = manageWorld({ admin: [
    { id: "c1", at, entity: "batch", entityId: "B-17", action: "create", patch: { name: "JEE 2028 Morning", centreId: "MLV", stream: "JEE", sessionStart: "2027-04-01", sessionEnd: "2028-03-31" } },
    { id: "c2", at, entity: "batch", entityId: "B-17", action: "archive", patch: {} },
    { id: "c3", at, entity: "batch", entityId: "B-17", action: "delete", patch: {} },
  ] });
  expect(world.batches.some((row) => row.id === "B-17")).toBe(false);
  expect(world.history.slice(0, 3).map((row) => [row.action, row.label])).toEqual([["delete", "JEE 2028 Morning"], ["archive", "JEE 2028 Morning"], ["create", "JEE 2028 Morning"]]);
  expect(world.history[1].changes).toEqual([{ field: "state", before: "active", after: "archived" }]);
});

it("counts archived students and needs active parents to restore (Codex ADMIN.1 review)", () => {
  const at = "2026-11-02T10:00:00.000Z";
  const student = { name: "Test Student", batchId: "B-17", enrolledOn: "2026-11-01", guardianName: "Test Guardian", guardianPhone: "+919812345678", guardianLanguage: "en", code: "STU-9001", gross: 12000000, discount: 0, discountReason: null };
  const replay = (extra: { entity: "student" | "batch" | "centre" | "staff"; entityId: string; action: "archive" }[]) => manageWorld({ admin: [
    { id: "c1", at, entity: "centre", entityId: "NEW", action: "create", patch: { code: "NEW", name: "New Centre" } },
    { id: "c2", at, entity: "batch", entityId: "B-17", action: "create", patch: { name: "JEE 2028 Morning", centreId: "NEW", stream: "JEE", sessionStart: "2027-04-01", sessionEnd: "2028-03-31" } },
    { id: "c3", at, entity: "student", entityId: "STU-9001", action: "create", patch: student },
    { id: "c4", at, entity: "staff", entityId: "STF-07", action: "create", patch: { fullName: "New Accounts", email: "new@demo.test", role: "accounts", centreId: "NEW" } },
    ...extra.map((change, index) => ({ ...change, id: `x${index}`, at, patch: {} })),
  ] });
  const archivedStudentOnly = batchVMs(replay([{ entity: "student", entityId: "STU-9001", action: "archive" }])).find((row) => row.id === "B-17")!;
  expect(archivedStudentOnly.actions).toMatchObject({ canArchive: false, canDelete: false, blockedReason: "1 archived student still belongs to this batch. Restore and move them first." });

  const world = replay([{ entity: "staff", entityId: "STF-07", action: "archive" }, { entity: "student", entityId: "STU-9001", action: "archive" }, { entity: "batch", entityId: "B-17", action: "archive" }, { entity: "centre", entityId: "NEW", action: "archive" }]);
  expect(staffVMs(world).find((row) => row.id === "STF-07")!.actions).toMatchObject({ canRestore: false, blockedReason: "Restore its centre first." });
  expect(studentVMs(world, {}, on).find((row) => row.id === "STU-9001")!.actions).toMatchObject({ canRestore: false, blockedReason: "Restore its batch and centre first." });
  expect(batchVMs(world).find((row) => row.id === "B-17")!.actions).toMatchObject({ canRestore: false, blockedReason: "Restore its centre first." });
});
