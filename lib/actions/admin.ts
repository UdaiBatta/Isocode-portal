"use server";
import { revalidatePath } from "next/cache";
import { backendResponse, backendResult } from "@/lib/backend";
async function action(name: string, input: unknown) {
  const result = await backendResult<{ id: string }>(await backendResponse(name, input));
  if (result.ok) revalidatePath("/staff/manage", "layout");
  return result;
}
export async function saveCentre(input: unknown) { return action("admin_save_centre", input); }
export async function saveBatch(input: unknown) { return action("admin_save_batch", input); }
export async function saveStaff(input: unknown) { return action("admin_save_staff", input); }
export async function saveStudent(input: unknown) { return action("admin_save_student", input); }
export async function changeFee(input: unknown) { return action("admin_change_fee", input); }
export async function archiveRecord(input: unknown) { return action("admin_archive", input); }
export async function restoreRecord(input: unknown) { return action("admin_restore", input); }
export async function deleteRecord(input: unknown) { return action("admin_delete", input); }
