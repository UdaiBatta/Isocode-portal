import { expect, it } from "vitest";
import { batchVMs, centreVMs, manageWorld, studentVMs } from "@/lib/fixtures/admin";

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
