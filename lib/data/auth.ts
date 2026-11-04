import { readProto } from "@/lib/fixtures/state";
import { students } from "@/lib/fixtures/catalog";
import { getLanguage } from "@/lib/i18n/server";
import { today } from "@/lib/clock";
import { getMe } from "@/lib/backend";
import { cookies } from "next/headers";

export function safeParentNext(value: unknown) {
  return typeof value === "string" && /^\/receipts\/[a-zA-Z0-9-]+$/.test(value) ? value : "/dashboard";
}

export async function getParentPageContext(next?: unknown) {
  return { ...await getAuthState(), language: await getLanguage(), today: await today(), next: safeParentNext(next), demo: process.env.DEMO_MODE === "true" };
}

export async function getAuthState() {
  const me = await getMe();
  if (me) return me;
  if ((await cookies()).get("sid")?.value) return { role: null, phone: null, centreId: null, consent: false, declined: false, children: [] };
  const state = await readProto();
  return { role: state.role ?? null, phone: state.phone ?? null, centreId: state.centreId ?? null, consent: state.consent ?? false, declined: state.declined ?? false, children: students.filter((student) => student.phone === state.phone).map((student) => ({ id: student.code, name: student.name })) };
}
