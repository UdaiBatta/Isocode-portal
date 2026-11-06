"use server";

import { z } from "zod";
import { dateSchema, fail, moneySchema, mutateProto, type ProtoState } from "@/lib/fixtures/state";
import { batchVMs, centreVMs, manageWorld, PROTO_ADMIN, staffVMs, studentVMs, type AdminChange } from "@/lib/fixtures/admin";
import { nowMs, today } from "@/lib/clock";
import type { ManageEntity, RecordActions } from "@/lib/types";

// Fixture paths only: every action replays and records changes in the prototype cookie. Django replaces these with the admin APIs on docs/progress.md.
const id = z.string().regex(/^[A-Za-z0-9-]{2,20}$/);
const name = z.string().trim().min(2).max(80);
const reason = z.string().trim().min(5).max(200);

async function record(state: ProtoState, change: Omit<AdminChange, "id" | "at">) {
  // shortcut: the prototype keeps 8 changes in its 3.8KB cookie. LIMIT: Django's audit_log has no cap.
  if ((state.admin?.length ?? 0) >= 8) fail("demo_full", "Reset the demo before recording more changes.");
  (state.admin ??= []).push({ ...change, id: `chg-${nowMs().toString(36)}`, at: `${await today()}T${new Date(nowMs()).toISOString().slice(11)}` });
  return { id: change.entityId };
}

async function rows(state: ProtoState) {
  const world = manageWorld(state);
  return { world, centres: centreVMs(world), batches: batchVMs(world), staff: staffVMs(world), students: studentVMs(world, state, await today()) };
}

// New IDs are never reused, even after a delete: the replay keys records by ID (Codex ADMIN.6).
const freshId = (state: ProtoState, prefix: string) => `${prefix}-${nowMs().toString(36).toUpperCase()}${state.admin?.length ?? 0}`;

const save = <T extends z.ZodRawShape>(shape: T) => z.object({ id: id.optional(), ...shape });

export async function saveCentre(input: unknown) {
  return mutateProto("admin", async (state) => {
    const value = save({ code: z.string().regex(/^[A-Z]{3}$/), name }).parse(input);
    const { centres } = await rows(state);
    const current = centres.find((row) => row.id === value.id);
    if (value.id && !current?.actions.canEdit) fail("not_found", "Centre not found or archived.");
    if (current && current.code !== value.code) fail("code_locked", "A centre code cannot change because receipt numbers use it.");
    if (!current && centres.some((row) => row.code === value.code)) fail("duplicate", "Another centre already uses this code.");
    return await record(state, { entity: "centre", entityId: current?.id ?? value.code, action: current ? "update" : "create", patch: current ? { name: value.name } : { code: value.code, name: value.name } });
  });
}

export async function saveBatch(input: unknown) {
  return mutateProto("admin", async (state) => {
    const value = save({ name: z.string().regex(/^(JEE|NEET) 20\d{2} (Morning|Evening)$/), centreId: id, stream: z.enum(["JEE", "NEET"]), sessionStart: dateSchema, sessionEnd: dateSchema }).parse(input);
    const { centres, batches, world } = await rows(state);
    const current = batches.find((row) => row.id === value.id);
    if (value.id && !current?.actions.canEdit) fail("not_found", "Batch not found or archived.");
    if (!centres.some((row) => row.id === value.centreId && row.state === "active")) fail("invalid_centre", "Choose an active centre.");
    if (!value.name.startsWith(`${value.stream} `)) fail("invalid_name", "The batch name must start with its exam.");
    if (batches.some((row) => row.id !== current?.id && row.centreId === value.centreId && row.name === value.name && row.state === "active")) fail("duplicate", "This centre already has an active batch with this exam, year and timing.");
    if (value.sessionEnd <= value.sessionStart) fail("invalid_dates", "The session must end after it starts.");
    if (current && current.centreId !== value.centreId && world.students.some((row) => row.batchId === current.id)) fail("has_students", "Move the students out before changing the centre.");
    const patch = { name: value.name, centreId: value.centreId, stream: value.stream, sessionStart: value.sessionStart, sessionEnd: value.sessionEnd };
    return await record(state, { entity: "batch", entityId: current?.id ?? freshId(state, "B"), action: current ? "update" : "create", patch });
  });
}

export async function saveStaff(input: unknown) {
  return mutateProto("admin", async (state) => {
    const value = save({ fullName: name, email: z.email().max(120), role: z.enum(["accounts", "counsellor", "admin"]), centreId: id.nullable(), password: z.string().min(12).max(128).optional() }).parse(input);
    const { centres, staff } = await rows(state);
    const current = staff.find((row) => row.id === value.id);
    if (value.id && !current?.actions.canEdit) fail("not_found", "Staff account not found or archived.");
    if (!current && !value.password) fail("password_required", "Set a temporary password of at least 12 characters.");
    if (value.role === "admin" ? value.centreId !== null : !centres.some((row) => row.id === value.centreId && row.state === "active")) fail("invalid_centre", value.role === "admin" ? "Admins work across all centres." : "Choose an active centre.");
    if (staff.some((row) => row.email.toLowerCase() === value.email.toLowerCase() && row.id !== current?.id)) fail("duplicate", "Another account already uses this email.");
    if (current?.id === PROTO_ADMIN.id && value.role !== "admin") fail("self", "You cannot change your own role.");
    // The password is checked and dropped: the prototype never stores one.
    return await record(state, { entity: "staff", entityId: current?.id ?? freshId(state, "STF"), action: current ? "update" : "create",
      patch: { fullName: value.fullName, email: value.email, role: value.role, centreId: value.centreId } });
  });
}

export async function saveStudent(input: unknown) {
  return mutateProto("admin", async (state) => {
    const value = save({ fullName: name, batchId: id, enrolledOn: dateSchema, guardianName: name, guardianPhone: z.string().regex(/^\+91[6-9]\d{9}$/), guardianLanguage: z.enum(["hi", "en"]),
      gross: moneySchema.optional(), discount: z.number().int().min(0).safe().optional(), discountReason: reason.optional() }).parse(input);
    const { batches, students, world } = await rows(state);
    const current = students.find((row) => row.id === value.id);
    if (value.id && !current?.actions.canEdit) fail("not_found", "Student not found or archived.");
    if (!batches.some((row) => row.id === value.batchId && row.state === "active")) fail("invalid_batch", "Choose an active batch.");
    if (value.enrolledOn > await today()) fail("invalid_date", "The enrolment date cannot be in the future.");
    const patch: AdminChange["patch"] = { name: value.fullName, batchId: value.batchId, enrolledOn: value.enrolledOn, guardianName: value.guardianName, guardianPhone: value.guardianPhone, guardianLanguage: value.guardianLanguage };
    if (current) return await record(state, { entity: "student", entityId: current.id, action: "update", patch });
    const discount = value.discount ?? 0;
    if (!value.gross) fail("fee_required", "Enter the course fee.");
    if (discount >= value.gross) fail("invalid_fee", "The discount must be less than the fee.");
    if (discount && !value.discountReason) fail("reason_required", "Give a reason for the discount.");
    const used = [...world.students.map((row) => String(row.code)), ...(state.admin ?? []).filter((change) => change.entity === "student").map((change) => change.entityId)];
    const code = `STU-${Math.max(...used.map((item) => Number(item.slice(4)) || 0)) + 1}`;
    return await record(state, { entity: "student", entityId: code, action: "create", patch: { ...patch, code, gross: value.gross, discount, discountReason: value.discountReason ?? null } });
  });
}

// Changes the fee or discount on the unpaid part only, never below what is already paid.
export async function changeFee(input: unknown) {
  return mutateProto("admin", async (state) => {
    const value = z.object({ studentId: id, gross: moneySchema, discount: z.number().int().min(0).safe(), reason }).parse(input);
    const student = (await rows(state)).students.find((row) => row.id === value.studentId);
    if (!student) fail("not_found", "Student not found.");
    if (!student.fee.editable) fail("locked", student.fee.lockedReason ?? "This fee can no longer change.");
    if (value.discount >= value.gross) fail("invalid_fee", "The discount must be less than the fee.");
    if (value.gross - value.discount < student.fee.paid) fail("below_paid", "The new fee cannot be less than what is already paid.");
    if (value.gross === student.fee.gross && value.discount === student.fee.discount) fail("unchanged", "Change the fee or the discount first.");
    return await record(state, { entity: "student", entityId: student.id, action: "fee", reason: value.reason, patch: { gross: value.gross, discount: value.discount, discountReason: value.discount ? value.reason : null } });
  });
}

const target = z.object({ entity: z.enum(["student", "batch", "centre", "staff"]), id });

async function lifecycle(input: unknown, action: "archive" | "restore" | "delete", allowed: keyof RecordActions) {
  return mutateProto("admin", async (state) => {
    const value = target.parse(input);
    const all = await rows(state);
    const lists: Record<ManageEntity, { id: string; actions: RecordActions }[]> = { student: all.students, batch: all.batches, centre: all.centres, staff: all.staff };
    const row = lists[value.entity].find((item) => item.id === value.id);
    if (!row) fail("not_found", "Record not found.");
    if (!row.actions[allowed]) fail("blocked", row.actions.blockedReason ?? "This record cannot change now.");
    return await record(state, { entity: value.entity, entityId: value.id, action, patch: {} });
  });
}

export async function archiveRecord(input: unknown) { return lifecycle(input, "archive", "canArchive"); }
export async function restoreRecord(input: unknown) { return lifecycle(input, "restore", "canRestore"); }
export async function deleteRecord(input: unknown) { return lifecycle(input, "delete", "canDelete"); }
