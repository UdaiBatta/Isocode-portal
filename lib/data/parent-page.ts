import { redirect } from "next/navigation";
import { getParentPageContext } from "./auth";
import { getFamily } from "./student";
import { previewState, type SearchParams } from "@/lib/preview";

// Every signed-in parent page starts the same way: gate access, read the child, and hold back data in preview states.
export async function parentPage(query: SearchParams) {
  const context = await getParentPageContext();
  const state = previewState(query);
  if (!state && context.role !== "parent") redirect("/login");
  if (!state && !context.consent) redirect("/consent");
  const student = typeof query.student === "string" ? query.student : undefined;
  const family = context.role === "parent" ? await getFamily(state ? undefined : student) : { family: [], selected: "" };
  return { context, language: context.language, today: context.today, student, state, shell: { language: context.language, state, ...family } };
}

export async function parentLoadingShell() {
  const context = await getParentPageContext();
  const family = context.role === "parent" && context.consent ? await getFamily().catch(() => null) : null;
  return { language: context.language, state: "loading" as const, family: family?.family ?? [], selected: family?.selected ?? "" };
}
