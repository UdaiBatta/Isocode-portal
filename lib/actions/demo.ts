"use server";
import { backendResponse, backendResult } from "@/lib/backend";
export async function setDemoDate(input: unknown) { return backendResult<{ date: string }>(await backendResponse("set_demo_date", input)); }
export async function runRemindersNow() { return backendResult<{ sent: number; skipped: number }>(await backendResponse("run_reminders_now", {})); }
export async function resetDemo() { return backendResult<{ reset: boolean; date: string }>(await backendResponse("reset_demo", {})); }
