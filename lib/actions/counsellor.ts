"use server";
import { backendResponse, backendResult } from "@/lib/backend";
export async function closeTask(input: unknown) { return backendResult<{ taskId: string }>(await backendResponse("close_task", input)); }
export async function ensureCallBrief(input: unknown) { return backendResult<{ brief: string; briefSource: "llm" | "template" }>(await backendResponse("ensure_call_brief", input)); }
