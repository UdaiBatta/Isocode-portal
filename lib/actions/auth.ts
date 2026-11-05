"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { mutateProto, fail, codeSchema } from "@/lib/fixtures/state";
import { students } from "@/lib/fixtures/catalog";
import { revalidatePath } from "next/cache";
import { backendResponse, backendResult, type BackendResult } from "@/lib/backend";
import { getLanguage } from "@/lib/i18n/server";

async function authAction<T extends object>(name: string, input: unknown): Promise<BackendResult<T>> {
  const response = await backendResponse(name, input);
  const result = await backendResult<T>(response);
  const header = response.headers.getSetCookie().find((value) => value.startsWith("sid="));
  if (header) {
    const value = header.slice(4).split(";")[0];
    const age = /;\s*max-age=(\d+)/i.exec(header)?.[1];
    if (age === undefined) throw new Error("The session cookie has no expiry.");
    (await cookies()).set("sid", value, { httpOnly: true, sameSite: "lax", path: "/", maxAge: Number(age), secure: process.env.APP_URL?.startsWith("https://") ?? false });
    revalidatePath("/", "layout");
  }
  return result;
}

export async function requestOtp(input: unknown) {
  return authAction<{ phone: string; demoCode?: string }>("request_otp", input);
}

export async function verifyOtp(input: unknown) {
  return authAction<{ verified: boolean; next: string }>("verify_otp", input);
}

export async function grantConsent(input: unknown) {
  if ((await cookies()).get("sid")?.value) {
    const data = typeof input === "object" && input !== null && !Array.isArray(input) ? input : {};
    return authAction<{ next: string }>("grant_consent", { ...data, language: await getLanguage() });
  }
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
  if ((await cookies()).get("sid")?.value) return authAction("decline_consent", {});
  return mutateProto("parent", (state) => {
    state.consent = false;
    state.declined = true;
    return {};
  });
}

export async function staffLogin(input: unknown) {
  return authAction<{ next: string }>("staff_login", input);
}

export async function setLanguage(input: unknown) {
  const result = await authAction<{ language: "hi" | "en" }>("set_language", input);
  if (result.ok) {
    const jar = await cookies();
    jar.set("lang", result.language, { sameSite: "lax", path: "/", maxAge: 31536000, secure: process.env.APP_URL?.startsWith("https://") ?? false });
    if (process.env.NEXT_PUBLIC_PROTO === "1" && jar.get("proto")) await mutateProto(null, (state) => {
      if (state.role === "parent" && state.phone) (state.languages ??= {})[state.phone] = result.language;
      return {};
    });
  }
  return result;
}

export async function logout() {
  if ((await cookies()).get("sid")?.value) {
    const result = await authAction<{ next: string }>("logout", {});
    if (!result.ok && result.code !== "unauthenticated") return result;
    (await cookies()).set("sid", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0, secure: process.env.APP_URL?.startsWith("https://") ?? false });
    (await cookies()).delete("proto");
    return { ok: true as const, next: "/login" };
  }
  return mutateProto(null, (state) => {
    delete state.role; delete state.phone; delete state.centreId; delete state.otp; delete state.consent; delete state.declined;
    return { next: "/login" };
  });
}
