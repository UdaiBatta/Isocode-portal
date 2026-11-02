import { readProto, requirePrototypeRole } from "@/lib/fixtures/state";
import { refundFor, refundPolicy } from "@/lib/fixtures/views";
import { requireCentre } from "./scope";
import { today } from "@/lib/clock";
import { getLanguage } from "@/lib/i18n/server";

export async function getRefund(code: string) {
  const state = await readProto();
  requirePrototypeRole(state, "accounts");
  requireCentre(state, code);
  return refundFor(state, code, await today());
}

export async function getRefundPolicy() { return refundPolicy; }

export async function getLocalizedRefundPolicy() {
  const language = await getLanguage();
  return { version: refundPolicy.version, text: language === "hi" ? refundPolicy.textHi : refundPolicy.textEn };
}
