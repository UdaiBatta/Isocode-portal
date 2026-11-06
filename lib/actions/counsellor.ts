"use server";

import { z } from "zod";
import { mutateProto, fail } from "@/lib/fixtures/state";
import { counsellorFor } from "@/lib/fixtures/views";
import { cookies } from "next/headers";
import { backendResponse, backendResult } from "@/lib/backend";

export async function closeTask(input: unknown) {
  if ((await cookies()).get("sid")?.value) return backendResult<{ taskId: string }>(await backendResponse("close_task", input));
  return mutateProto("counsellor", (state) => {
    const value = z.object({ taskId: z.string().max(30), outcome: z.enum(["called", "false_flag"]), note: z.string().trim().max(300) }).parse(input);
    const task = counsellorFor(state).open.find((item) => item.id === value.taskId);
    if (!task) fail("closed", "This task is already closed.");
    if (value.outcome === "false_flag" && !value.note) fail("note_required", "Explain why this was a false flag.");
    (state.outcomes ??= {})[task.id] = { outcome: value.outcome, note: value.note };
    return { taskId: task.id };
  });
}

export async function ensureCallBrief(input: unknown) {
  if ((await cookies()).get("sid")?.value) return backendResult<{ brief: string; briefSource: "llm" | "template" }>(await backendResponse("ensure_call_brief", input));
  return mutateProto("counsellor", (state) => {
    const { taskId } = z.object({ taskId: z.string().max(30) }).parse(input);
    const view = counsellorFor(state);
    const task = [...view.open, ...view.closed].find((item) => item.id === taskId);
    if (!task) fail("not_found", "Task not found.");
    return { brief: task.brief, briefSource: task.briefSource };
  });
}
