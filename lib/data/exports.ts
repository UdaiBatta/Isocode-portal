import { redirect } from "next/navigation";
import { backendResponse, backendResult } from "@/lib/backend";

export async function getExport(kind: "dues" | "receipts", filters: { centre?: string; batch?: string } = {}) {
  if (kind !== "dues" && kind !== "receipts") throw new Error("Choose a valid export.");
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== undefined));
  const response = await backendResponse(`export/${kind}.csv?${query}`);
  if (response.status === 401) redirect("/staff/login");
  if (!response.ok) {
    const result = await backendResult(response);
    throw new Error(result.ok ? "Export failed." : result.message);
  }
  const filename = response.headers.get("Content-Disposition")?.match(/filename="([a-z0-9-]+\.csv)"/)?.[1];
  if (!filename || !response.headers.get("Content-Type")?.startsWith("text/csv")) throw new Error("Unexpected export response.");
  return { filename, text: await response.text() };
}
