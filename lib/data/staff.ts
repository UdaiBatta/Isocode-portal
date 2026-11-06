import { backend, getMe } from "@/lib/backend";
import { redirect } from "next/navigation";
export async function getStaffPageContext() {
  const me = await getMe();
  if (!me) redirect("/staff/login");
  return { role: me.role, today: me.today, demo: process.env.DEMO_MODE === "true" };
}
export async function getStaffDirectory() {
  return backend<{ centres: { id: string; name: string }[]; batches: { id: string; name: string; centreId: string }[];
    students: { code: string; name: string; centreId: string; batchId: string }[] }>("staff_directory", "/staff/login");
}
export async function getPaymentCandidates() {
  return (await backend<{ candidates: { code: string; name: string; instalments: { id: string; balance: number; seq: number }[] }[] }>("payment_candidates", "/staff/login")).candidates;
}
