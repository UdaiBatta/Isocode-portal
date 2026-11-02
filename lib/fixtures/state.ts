import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export const codeSchema = z.string().regex(/^STU-\d{4}$/);
export const dateSchema = z.iso.date();
export const moneySchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const noteSchema = z.string().max(300);
const paymentSchema = z.object({ studentCode: codeSchema, amount: moneySchema, on: dateSchema, method: z.enum(["upi", "card", "netbanking", "gateway", "cash", "cheque", "bank"]), instalmentId: z.string().max(50).optional() });
const refundSchema = z.object({ withdrawalDate: dateSchema, reason: z.enum(["Personal", "Moved city", "Changed course", "Health", "Other"]), status: z.enum(["draft", "approved", "paid"]) });
const stateSchema = z.object({
  role: z.enum(["parent", "accounts", "counsellor"]).optional(),
  phone: z.string().regex(/^\+91[6-9]\d{9}$/).optional(),
  centreId: z.enum(["MLV", "VSH", "MSR", "RJP"]).optional(),
  consent: z.boolean().optional(),
  consentedPhones: z.array(z.string()).max(12).optional(),
  declined: z.boolean().optional(),
  date: dateSchema.optional(),
  languages: z.record(z.string(), z.enum(["hi", "en"])).optional(),
  payments: z.array(paymentSchema).max(12).optional(),
  paymentResults: z.record(z.string(), z.object({ token: z.string(), result: z.enum(["paid", "failed", "checking", "already_paid"]), amount: moneySchema, receiptId: z.string().nullable(), method: z.enum(["upi", "card", "netbanking"]).optional(), on: dateSchema.optional() })).optional(),
  held: z.array(z.object({ id: z.string().max(30), amount: moneySchema, on: dateSchema, instalmentId: z.string().max(50).optional(), reason: z.enum(["amount_mismatch", "excess_counter_payment"]) })).max(6).optional(),
  resolved: z.record(z.string(), z.object({ action: z.enum(["match", "reject"]), note: noteSchema })).optional(),
  refunds: z.record(z.string(), refundSchema).optional(),
  outcomes: z.record(z.string(), z.object({ outcome: z.enum(["called", "false_flag"]), note: noteSchema })).optional(),
  sent: z.array(z.object({ instalmentId: z.string().max(50), step: z.number().int(), on: dateSchema, amount: moneySchema, language: z.enum(["hi", "en"]) })).max(8).optional(),
  otp: z.object({ attempts: z.number().int().min(0).max(5), sends: z.number().int().min(1).max(3), verified: z.boolean(), firstSentAt: z.number().optional(), lastSentAt: z.number().optional(), expiresAt: z.number().optional() }).optional(),
});

export type ProtoState = z.infer<typeof stateSchema>;
export type ProtoPayment = z.infer<typeof paymentSchema>;
export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; code: string; message: string };

export async function readProto(): Promise<ProtoState> {
  const value = (await cookies()).get("proto")?.value;
  if (!value || value.length > 3800) return {};
  try {
    const parsed = stateSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : {};
  } catch { return {}; }
}

class PrototypeError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export function fail(code: string, message: string): never {
  throw new PrototypeError(code, message);
}

export function requirePrototypeRole(state: ProtoState, role: "parent" | "accounts" | "counsellor") {
  if (state.role && state.role !== role) fail("forbidden", "This prototype view belongs to another role.");
}

export async function mutateProto<T extends object>(role: "parent" | "accounts" | "counsellor" | null, change: (state: ProtoState) => T | Promise<T>): Promise<ActionResult<T>> {
  if (process.env.NEXT_PUBLIC_PROTO !== "1") return { ok: false, code: "disabled", message: "Prototype mode is disabled." };
  try {
    const state = await readProto();
    if (role) requirePrototypeRole(state, role);
    const result = await change(state);
    const value = JSON.stringify(stateSchema.parse(state));
    // shortcut: demo history has a 3.8KB cookie ceiling, replace it with Django persistence after Gate 0. LIMIT: no concurrent-tab guarantees.
    if (encodeURIComponent(value).length > 3800) fail("demo_full", "Reset the demo before recording more activity.");
    (await cookies()).set("proto", value, { httpOnly: true, sameSite: "lax", secure: process.env.APP_URL?.startsWith("https://") ?? process.env.NODE_ENV === "production", path: "/" });
    revalidatePath("/", "layout");
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof PrototypeError) return { ok: false, code: error.code, message: error.message };
    if (error instanceof z.ZodError) return { ok: false, code: "invalid", message: "Check the entered values." };
    throw error;
  }
}
