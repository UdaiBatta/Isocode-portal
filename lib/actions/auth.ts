"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { mutateProto, fail, codeSchema } from "@/lib/fixtures/state";
import { students } from "@/lib/fixtures/catalog";
import { nowMs } from "@/lib/clock";

const phoneSchema = z.string().max(30).transform((input) => {
  let digits = input.replace(/[\s+-]/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}).pipe(z.string().regex(/^[6-9]\d{9}$/)).transform((digits) => `+91${digits}`);

export async function requestOtp(input: unknown) {
  return mutateProto(null, (state) => {
    const { phone } = z.object({ phone: phoneSchema }).parse(input);
    const now = nowMs();
    const previous = state.phone === phone ? state.otp : undefined;
    const inWindow = previous?.firstSentAt !== undefined && now - previous.firstSentAt < 600000;
    const sends = inWindow ? previous.sends : 0;
    if (previous?.lastSentAt !== undefined && now - previous.lastSentAt < 30000) fail("cooldown", "Wait before requesting another code.");
    if (sends >= 3) fail("too_many", "Wait ten minutes before requesting another code.");
    if (state.phone !== phone) { state.consent = state.consentedPhones?.includes(phone) ?? false; delete state.declined; delete state.role; }
    state.phone = phone;
    state.otp = { attempts: 0, sends: sends + 1, verified: false, firstSentAt: inWindow ? previous.firstSentAt : now, lastSentAt: now, expiresAt: now + 300000 };
    return { phone, demoCode: "123456" };
  });
}

export async function verifyOtp(input: unknown) {
  const result = await mutateProto(null, (state) => {
    const value = z.object({ phone: phoneSchema, code: z.string().regex(/^\d{6}$/) }).parse(input);
    if (state.phone !== value.phone || !state.otp || state.otp.verified) fail("expired", "Request a new prototype code.");
    if (state.otp.expiresAt !== undefined && nowMs() >= state.otp.expiresAt) fail("expired", "Request a new prototype code.");
    if (state.otp.attempts >= 5) fail("too_many", "Too many attempts. Request a new prototype code.");
    if (value.code !== "123456") { state.otp.attempts++; return { verified: false, next: "/login" }; }
    state.otp.verified = true;
    state.role = "parent";
    delete state.centreId;
    return { verified: true, next: state.consent ? "/dashboard" : "/consent" };
  });
  return result.ok && !result.verified ? { ok: false as const, code: "code_wrong", message: "The prototype code is incorrect." } : result;
}

export async function grantConsent(input: unknown) {
  return mutateProto("parent", (state) => {
    const value = z.object({ studentIds: z.array(codeSchema).min(1), wordingVersion: z.literal("v1") }).parse(input);
    const linked = students.filter((student) => student.phone === state.phone);
    if (!state.otp?.verified || linked.length === 0 || value.studentIds.length !== linked.length || linked.some((student) => !value.studentIds.includes(student.code))) fail("forbidden", "Consent must cover this prototype family.");
    state.consent = true;
    if (state.phone && !state.consentedPhones?.includes(state.phone)) (state.consentedPhones ??= []).push(state.phone);
    state.declined = false;
    return { next: "/dashboard" };
  });
}

export async function declineConsent() {
  return mutateProto("parent", (state) => {
    state.consent = false;
    state.declined = true;
    return {};
  });
}

export async function staffLogin(input: unknown) {
  return mutateProto(null, (state) => {
    const value = z.object({ email: z.email().transform((email) => email.toLowerCase()), password: z.string().max(100) }).parse(input);
    const accounts = value.email === "accounts@demo.test" || value.email === "accounts.mlv@demo.test";
    if ((!accounts && value.email !== "counsellor@demo.test") || value.password !== "prototype") fail("credentials", "The email or prototype password is incorrect.");
    state.role = accounts ? "accounts" : "counsellor";
    if (value.email === "accounts.mlv@demo.test") state.centreId = "MLV";
    else delete state.centreId;
    return { next: accounts ? "/staff/dashboard" : "/counsellor/tasks" };
  });
}

export async function setLanguage(input: unknown) {
  const result = await mutateProto(null, (state) => {
    const { language } = z.object({ language: z.enum(["hi", "en"]) }).parse(input);
    if (state.phone) (state.languages ??= {})[state.phone] = language;
    return { language };
  });
  if (result.ok) (await cookies()).set("lang", result.language, { sameSite: "lax", path: "/", maxAge: 31536000, secure: process.env.APP_URL?.startsWith("https://") ?? process.env.NODE_ENV === "production" });
  return result;
}

export async function logout() {
  return mutateProto(null, (state) => {
    delete state.role; delete state.phone; delete state.centreId; delete state.otp; delete state.consent; delete state.declined;
    return { next: "/login" };
  });
}
