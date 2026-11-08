"use server";
import { cookies } from "next/headers";
import { z } from "zod";
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


export async function requestOtp(input: unknown) { return authAction<{ phone: string; demoCode?: string }>("request_otp", input); }
export async function verifyOtp(input: unknown) { return authAction<{ verified: boolean; next: string }>("verify_otp", input); }
export async function staffLogin(input: unknown) { return authAction<{ next: string }>("staff_login", input); }
export async function grantConsent(input: unknown) {
  const parsed = z.object({ studentIds: z.array(z.string().regex(/^STU-\d{4}$/)).min(1), wordingVersion: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "invalid", message: "Choose the children and consent wording." };
  return authAction<{ next: string }>("grant_consent", { ...parsed.data, language: await getLanguage() });
}
export async function declineConsent() { return authAction("decline_consent", {}); }
export async function setLanguage(input: unknown) {
  const result = await authAction<{ language: "hi" | "en" }>("set_language", input);
  if (result.ok) (await cookies()).set("lang", result.language, { sameSite: "lax", path: "/", maxAge: 31536000, secure: process.env.APP_URL?.startsWith("https://") ?? false });
  return result;
}
export async function logout() {
  const result = await authAction<{ next: string }>("logout", {});
  if (!result.ok && result.code !== "unauthenticated") return result;
  (await cookies()).set("sid", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0, secure: process.env.APP_URL?.startsWith("https://") ?? false });
  return { ok: true as const, next: "/login" };
}
