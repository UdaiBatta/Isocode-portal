"use server";

import { backendResponse, backendResult } from "@/lib/backend";

export type UploadKind = "attendance" | "tests";
export interface UploadResult { rows: number; errors: { line: number; message: string }[]; applied: boolean }

// Django checks role, centre scope and every row; commit false only validates.
export async function uploadProgress(input: { batchId: string; kind: UploadKind; csv: string; commit: boolean }) {
  return backendResult<UploadResult>(await backendResponse("upload_progress", input));
}
