import { getLanguage } from "@/lib/i18n/server";
import { getMe, getPublicContext } from "@/lib/backend";
export function safeParentNext(value: unknown) {
  return typeof value === "string" && /^\/receipts\/[a-zA-Z0-9-]+$/.test(value) ? value : "/dashboard";
}
export async function getParentPageContext(next?: unknown) {
  const state = await getAuthState();
  return { ...state, language: await getLanguage(), next: safeParentNext(next), demo: process.env.DEMO_MODE === "true" };
}
export async function getAuthState() {
  const me = await getMe();
  if (me) return me;
  const context = await getPublicContext();
  return { role: null, phone: null, centreId: null, consent: false, declined: false, children: [], today: context.today };
}
