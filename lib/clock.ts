import { readPreviewState } from "@/lib/fixtures/state";

export function nowMs() { return Date.now(); }

export async function today(): Promise<string> {
  return (await readPreviewState()).date ?? "2026-11-02";
}
