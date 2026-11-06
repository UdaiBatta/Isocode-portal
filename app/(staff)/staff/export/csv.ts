import { unstable_rethrow } from "next/navigation";
import { getExport } from "@/lib/data/exports";

// B9: the browser downloads CSVs from Next.js; Django rechecks the accounts role and centre scope. No fixtures here.
export async function csvResponse(kind: "dues" | "receipts", request: Request) {
  const params = new URL(request.url).searchParams;
  const pick = (key: string) => params.get(key) || undefined;
  try {
    const { filename, text } = await getExport(kind, { centre: pick("centre"), batch: pick("batch") });
    return new Response(text, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
  } catch (error) {
    unstable_rethrow(error); // A signed-out request is redirected to staff sign-in by Next.js.
    return new Response(error instanceof Error ? error.message : "Export failed.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
}
