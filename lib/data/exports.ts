import { redirect } from "next/navigation";
import { backendResponse, backendResult } from "@/lib/backend";

export async function getExport(kind: "dues" | "receipts" | "tally", filters: { centre?: string; batch?: string } = {}) {
  if (kind !== "dues" && kind !== "receipts" && kind !== "tally") throw new Error("Choose a valid export.");
  const extension = kind === "tally" ? "xml" : "csv";
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== undefined));
  const response = await backendResponse(`export/${kind}.${extension}?${query}`);
  if (response.status === 401) redirect("/staff/login");
  if (!response.ok) {
    const result = await backendResult(response);
    throw new Error(result.ok ? "Export failed." : result.message);
  }
  const filename = response.headers.get("Content-Disposition")?.match(/filename="([a-z0-9-]+\.(csv|xml))"/)?.[1];
  if (!filename?.endsWith(`.${extension}`) || !response.headers.get("Content-Type")?.startsWith(`text/${extension}`)) throw new Error("Unexpected export response.");
  return { filename, text: await response.text() };
}
