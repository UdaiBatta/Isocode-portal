import { readProto, fail, requirePrototypeRole } from "@/lib/fixtures/state";
import { receiptsFor } from "@/lib/fixtures/views";
import { students } from "@/lib/fixtures/catalog";
import { parentContext, requireCentre } from "./scope";
import { ORG } from "@/lib/config";

export async function getReceiptOrganisation() { return ORG; }

export async function getReceipts(studentId?: string) {
  const { state, student } = await parentContext(studentId);
  return receiptsFor(state, student.code);
}

export async function getReceipt(id: string) {
  const state = await readProto();
  if (state.role === "counsellor") fail("forbidden", "Receipt not found.");
  for (const student of students) {
    const receipt = receiptsFor(state, student.code).find((item) => item.id === id);
    if (!receipt) continue;
    if (state.role === "accounts") { requirePrototypeRole(state, "accounts"); requireCentre(state, student.code); }
    else await parentContext(student.code);
    return receipt;
  }
  fail("not_found", "Receipt not found.");
}
