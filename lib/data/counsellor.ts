import { readProto, requirePrototypeRole } from "@/lib/fixtures/state";
import { counsellorFor } from "@/lib/fixtures/views";
import { cookies } from "next/headers";
import { backend } from "@/lib/backend";
import type { CounsellorVM } from "@/lib/types";

export async function getCounsellor() {
  if ((await cookies()).get("sid")?.value) return backend<CounsellorVM>("counsellor", "/staff/login");
  const state = await readProto();
  requirePrototypeRole(state, "counsellor");
  return counsellorFor(state);
}
