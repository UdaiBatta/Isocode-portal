import { readProto, requirePrototypeRole } from "@/lib/fixtures/state";
import { refundFor } from "@/lib/fixtures/views";
import { cookies } from "next/headers";
import { backend } from "@/lib/backend";
import type { RefundVM } from "@/lib/types";
import { requireCentre } from "./scope";
import { today } from "@/lib/clock";
import { getLanguage } from "@/lib/i18n/server";

export async function getRefund(code: string, withdrawalDate?: string) {
  if ((await cookies()).get("sid")?.value) {
    return backend<RefundVM>(`refund?student=${encodeURIComponent(code)}${withdrawalDate ? `&withdrawalDate=${encodeURIComponent(withdrawalDate)}` : ""}`, "/staff/login");
  }
  const state = await readProto();
  requirePrototypeRole(state, "accounts");
  requireCentre(state, code);
  return refundFor(state, code, await today());
}

export async function getRefundPolicy() {
  return backend<{ version: string; textEn: string; textHi: string }>("refund_policy");
}

export async function getLocalizedRefundPolicy() {
  const language = await getLanguage();
  const policy = await getRefundPolicy();
  return { version: policy.version, text: language === "hi" ? policy.textHi : policy.textEn };
}
