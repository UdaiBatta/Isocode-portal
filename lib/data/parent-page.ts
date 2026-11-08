import { redirect } from "next/navigation";
import { getParentPageContext } from "./auth";
import { getFamily } from "./student";
import type { SearchParams } from "@/lib/types";

// Every signed-in parent page starts the same way: gate access, then read the child.
export async function parentPage(query: SearchParams) {
  const context = await getParentPageContext();
  if (context.role !== "parent") redirect("/login");
  if (!context.consent) redirect("/consent");
  const student = typeof query.student === "string" ? query.student : undefined;
  const family = await getFamily(student);
  return { context, language: context.language, today: context.today, student, shell: { language: context.language, ...family } };
}

export async function parentLoadingShell() {
  const context = await getParentPageContext();
  const family = context.role === "parent" && context.consent ? await getFamily().catch(() => null) : null;
  return { language: context.language, state: "loading" as const, family: family?.family ?? [], selected: family?.selected ?? "" };
}
