import { unstable_rethrow } from "next/navigation";
import { getExport } from "@/lib/data/exports";

// B9: the only files the browser can download; anything else is a 404. Django rechecks the accounts role and centre scope.
const files = {
  "dues.csv": ["dues", "text/csv; charset=utf-8"],
  "receipts.csv": ["receipts", "text/csv; charset=utf-8"],
} as const;

export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!Object.hasOwn(files, file)) return new Response("Not found", { status: 404 });
  const [kind, type] = files[file as keyof typeof files];
  const query = new URL(request.url).searchParams;
  const pick = (key: string) => query.get(key) || undefined;
  try {
    const { filename, text } = await getExport(kind, { centre: pick("centre"), batch: pick("batch") });
    return new Response(text, { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
  } catch (error) {
    unstable_rethrow(error); // A signed-out request is redirected to staff sign-in by Next.js.
    return new Response(error instanceof Error ? error.message : "Export failed.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
}
