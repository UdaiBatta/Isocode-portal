"use server";
import { getExport } from "@/lib/data/exports";
export async function exportCsv(kind: "dues" | "receipts", filters: { centre?: string; batch?: string }) { return getExport(kind, filters); }
