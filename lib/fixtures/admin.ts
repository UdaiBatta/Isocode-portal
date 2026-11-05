import { batches, centres, students } from "./catalog";
import { ledgerFor } from "./views";
import type { AdminChange, ProtoState } from "./state";
import type { AdminBatchVM, AdminCentreVM, AdminStaffVM, AdminStudentVM, ChangeVM, ManageEntity, RecordActions, RecordState } from "@/lib/types";

// Fictional staff for the prototype Manage screens (B10: no real personal data).
const baseStaff = [
  { id: "STF-01", fullName: "Kavita Sharma", email: "accounts@demo.test", role: "accounts", centreId: "MLV" },
  { id: "STF-02", fullName: "Rahul Verma", email: "accounts.vsh@demo.test", role: "accounts", centreId: "VSH" },
  { id: "STF-03", fullName: "Neha Gupta", email: "counsellor@demo.test", role: "counsellor", centreId: "MLV" },
  { id: "STF-04", fullName: "Imran Khan", email: "counsellor.msr@demo.test", role: "counsellor", centreId: "MSR" },
  { id: "STF-05", fullName: "Pooja Agarwal", email: "admin@demo.test", role: "admin", centreId: null },
  { id: "STF-06", fullName: "Sanjay Mathur", email: "new.accounts@demo.test", role: "accounts", centreId: "RJP" },
] as const;
// Staff who have recorded payments or resolved queue items can only be archived.
const staffWithActivity = new Set(["STF-01", "STF-02", "STF-03", "STF-04", "STF-05"]);
export const PROTO_ADMIN = { id: "STF-05", name: "Pooja Agarwal" };
const SESSION = { start: "2026-04-01", end: "2027-03-31" };

type Row = Record<string, string | number | null> & { id: string; state: RecordState };
export interface ManageWorld { centres: Row[]; batches: Row[]; staff: Row[]; students: Row[]; history: ChangeVM[] }

const seedHistory: ChangeVM[] = [
  { id: "seed-2", at: "2026-10-28T10:15:00Z", actor: PROTO_ADMIN.name, action: "update", entity: "staff", entityId: "STF-02", label: "Rahul Verma", changes: [{ field: "centreId", before: "MLV", after: "VSH" }], reason: null },
  { id: "seed-1", at: "2026-10-12T06:40:00Z", actor: PROTO_ADMIN.name, action: "fee", entity: "student", entityId: "STU-1001", label: "Ananya Saini", changes: [{ field: "discount", before: 0, after: 1200000 }], reason: "Sibling discount approved by the director" },
];

function baseWorld(): ManageWorld {
  return {
    centres: centres.map((item) => ({ id: item.id, code: item.id, name: item.name, state: "active" })),
    batches: batches.map((item) => ({ id: item.id, name: item.name, centreId: item.centreId, stream: item.name.split(" ")[0], sessionStart: SESSION.start, sessionEnd: SESSION.end, state: "active" })),
    staff: baseStaff.map((item) => ({ ...item, state: item.id === "STF-06" ? "archived" : "active" })),
    students: students.map((item) => {
      const centreId = item.centreId ?? "MLV";
      return { id: item.code, code: item.code, name: item.name, batchId: batches.find((batch) => batch.centreId === centreId && batch.name === item.batch)!.id,
        enrolledOn: item.enrolledOn, guardianName: `Guardian of ${item.name.split(" ")[0]}`, guardianPhone: item.phone, guardianLanguage: item.language,
        gross: 12000000, discount: item.discount ?? 0, discountReason: item.discount ? "Sibling discount" : null, state: "active" };
    }),
    history: [...seedHistory],
  };
}

const lists: Record<ManageEntity, keyof Omit<ManageWorld, "history">> = { centre: "centres", batch: "batches", staff: "staff", student: "students" };
export const labelOf = (row: Row) => String(row.name ?? row.fullName ?? row.code);

// Replays the prototype's recorded admin changes over the fixture catalog, building the history as it goes.
export function manageWorld(state: ProtoState): ManageWorld {
  const world = baseWorld();
  for (const change of state.admin ?? []) {
    const list = world[lists[change.entity]];
    const index = list.findIndex((row) => row.id === change.entityId);
    const before = index >= 0 ? list[index] : null;
    const after: Row | null = change.action === "delete" ? null : { ...(before ?? { id: change.entityId, state: "active" }), ...change.patch,
      ...(change.action === "archive" ? { state: "archived" } : change.action === "restore" ? { state: "active" } : {}) } as Row;
    if (after) { if (index >= 0) list[index] = after; else list.push(after); } else if (index >= 0) list.splice(index, 1);
    const fields = change.action === "archive" || change.action === "restore" ? ["state"] : change.action === "delete" ? [] : Object.keys(change.patch);
    world.history.unshift({ id: change.id, at: change.at, actor: PROTO_ADMIN.name, action: change.action, entity: change.entity, entityId: change.entityId,
      label: labelOf((after ?? before)!), reason: change.reason ?? null,
      changes: fields.filter((field) => (before?.[field] ?? null) !== (after?.[field] ?? null)).map((field) => ({ field, before: before?.[field] ?? null, after: after?.[field] ?? null })) });
  }
  return world;
}

const allow = (actions: Partial<RecordActions>): RecordActions => ({ canEdit: false, canArchive: false, canRestore: false, canDelete: false, blockedReason: null, ...actions });
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

export function centreVMs(world: ManageWorld): AdminCentreVM[] {
  return world.centres.map((row) => {
    const own = world.batches.filter((batch) => batch.centreId === row.id);
    const activeBatches = own.filter((batch) => batch.state === "active").length;
    const studentCount = world.students.filter((student) => own.some((batch) => batch.id === student.batchId) && student.state === "active").length;
    const staffCount = world.staff.filter((staff) => staff.centreId === row.id && staff.state === "active").length;
    const active = row.state === "active";
    return { id: row.id, code: String(row.code), name: String(row.name), state: row.state, batches: activeBatches, students: studentCount, staff: staffCount,
      actions: allow({ canEdit: active, canArchive: active && activeBatches === 0 && staffCount === 0, canRestore: !active, canDelete: own.length === 0 && !world.staff.some((staff) => staff.centreId === row.id),
        blockedReason: active && activeBatches + staffCount > 0 ? `First ${[activeBatches ? `archive its ${plural(activeBatches, "batch", "batches")}` : "", staffCount ? `move its ${plural(staffCount, "staff account")}` : ""].filter(Boolean).join(" and ")}.` : null }) };
  });
}

export function batchVMs(world: ManageWorld): AdminBatchVM[] {
  return world.batches.map((row) => {
    const own = world.students.filter((student) => student.batchId === row.id);
    const current = own.filter((student) => student.state === "active").length;
    const active = row.state === "active";
    const centre = world.centres.find((item) => item.id === row.centreId);
    return { id: row.id, name: String(row.name), centreId: String(row.centreId), centre: String(centre?.name ?? row.centreId), stream: row.stream as "JEE" | "NEET",
      sessionStart: String(row.sessionStart), sessionEnd: String(row.sessionEnd), state: row.state, students: current,
      actions: allow({ canEdit: active, canArchive: active && current === 0, canRestore: !active && centre?.state === "active", canDelete: own.length === 0,
        blockedReason: current ? `Move its ${plural(current, "student")} to another batch first.` : own.length ? "Archived students keep this batch, so it can be archived but not deleted." : null }) };
  });
}

export function staffVMs(world: ManageWorld): AdminStaffVM[] {
  return world.staff.map((row) => {
    const active = row.state === "active";
    const self = row.id === PROTO_ADMIN.id;
    const centre = world.centres.find((item) => item.id === row.centreId);
    return { id: row.id, fullName: String(row.fullName), email: String(row.email), role: row.role as AdminStaffVM["role"], centreId: row.centreId === null ? null : String(row.centreId),
      centre: centre ? String(centre.name) : null, state: row.state,
      actions: allow({ canEdit: active, canArchive: active && !self, canRestore: !active, canDelete: !self && !staffWithActivity.has(row.id),
        blockedReason: self ? "You cannot archive or delete your own account." : staffWithActivity.has(row.id) ? "Has recorded payments or reviews, so it can be archived but not deleted." : null }) };
  });
}

export function studentVMs(world: ManageWorld, state: ProtoState, today: string): AdminStudentVM[] {
  return world.students.map((row) => {
    const known = students.some((item) => item.code === row.id);
    const ledger = known ? ledgerFor(state, row.id, today) : null;
    const paid = ledger?.plan.paid ?? 0;
    const status = ledger?.student.status ?? "active";
    const net = Number(row.gross) - Number(row.discount);
    const batch = world.batches.find((item) => item.id === row.batchId);
    const centre = world.centres.find((item) => item.id === batch?.centreId);
    const hasPayments = (ledger?.payments.length ?? 0) > 0;
    const active = row.state === "active";
    const settled = status === "withdrawn" || paid >= net;
    return { id: row.id, code: String(row.code), name: String(row.name), batchId: String(row.batchId), batch: String(batch?.name ?? ""), centreId: String(batch?.centreId ?? ""), centre: String(centre?.name ?? ""),
      status, state: row.state, enrolledOn: String(row.enrolledOn),
      guardian: { name: String(row.guardianName), phone: String(row.guardianPhone), language: row.guardianLanguage === "hi" ? "hi" : "en" },
      fee: { gross: Number(row.gross), discount: Number(row.discount), discountReason: row.discountReason === null ? null : String(row.discountReason), net, paid,
        editable: active && !settled, lockedReason: status === "withdrawn" ? "Withdrawn. Fee changes go through the refund." : settled ? "Fully paid. Payments are never edited." : null },
      actions: allow({ canEdit: active, canArchive: active && settled, canRestore: !active, canDelete: !hasPayments,
        blockedReason: active && !settled ? "Still studying with a balance. Withdraw through the refund flow first." : hasPayments ? "Has payments or receipts, so it can be archived but not deleted." : null }) };
  });
}

export type { AdminChange };
