import { backend } from "@/lib/backend";
import type { RefundVM } from "@/lib/types";
import { getLanguage } from "@/lib/i18n/server";
export async function getRefund(code: string, withdrawalDate?: string) {
  return backend<RefundVM>(`refund?student=${encodeURIComponent(code)}${withdrawalDate ? `&withdrawalDate=${encodeURIComponent(withdrawalDate)}` : ""}`, "/staff/login");
}
export async function getRefundPolicy() {
  return backend<{ version: string; textEn: string; textHi: string }>("refund_policy");
}

export async function getLocalizedRefundPolicy() {
  const language = await getLanguage();
  const policy = await getRefundPolicy();
  return { version: policy.version, text: language === "hi" ? policy.textHi : policy.textEn };
}
