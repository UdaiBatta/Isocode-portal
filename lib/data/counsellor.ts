import { backend } from "@/lib/backend";
import type { CounsellorVM } from "@/lib/types";
export async function getCounsellor() { return backend<CounsellorVM>("counsellor", "/staff/login"); }
