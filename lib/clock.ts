import { readProto } from "@/lib/fixtures/state";

export async function today(): Promise<string> {
  return (await readProto()).date ?? "2026-11-02";
}
