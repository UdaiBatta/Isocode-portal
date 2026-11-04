import { redirect } from "next/navigation";
import { DuesStatus, feeTotals } from "@/components/app/DuesStatus";
import { InstalmentDisclosure } from "@/components/app/InstalmentDisclosure";
import { ParentDetails, ParentShell, parentSectionClass } from "@/components/app/ParentShell";
import { LinkButton } from "@/components/base/buttons/link-button";
import { getParentPageContext } from "@/lib/data/auth";
import { getDues } from "@/lib/data/dues";
import { previewState, type SearchParams } from "@/lib/preview";
import { inr } from "@/lib/format";
import { t } from "@/lib/i18n";
import { pt } from "@/lib/i18n/portal";

export default async function Dues({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const context = await getParentPageContext();
  const { language, today } = context;
  const state = previewState(params);
  const header = { language, active: "fees", title: pt(language, "portal.fees"), description: pt(language, "fees.description"), emptyTitle: t(language, "dues.clear") } as const;
  if (state) return <ParentShell {...header} state={state} family={[]} selected="" />;
  if (context.role === "parent" && !context.consent) redirect("/consent");
  if (context.role && context.role !== "parent") redirect("/staff/login");
  const view = await getDues(typeof params.student === "string" ? params.student : undefined);
  const { total, paid, remaining } = feeTotals(view);
  return <ParentShell {...header} family={view.children} selected={view.selectedStudentId}>
    <DuesStatus view={view} language={language} today={today} />
    {view.mode !== "withdrawn" ? <section className={parentSectionClass}>
      <h2 className="text-headline-medium">{pt(language, "fees.summary")}</h2>
      <ParentDetails rows={[[pt(language, "fees.total"), inr(total)], [pt(language, "fees.paid"), inr(paid)], [pt(language, "fees.remaining"), inr(remaining)]]} />
      <InstalmentDisclosure instalments={view.instalments} language={language} today={today} />
    </section> : null}
    <section className={parentSectionClass}><div><LinkButton href={`/receipts?student=${view.selectedStudentId}`} variant="secondary">{t(language, "dues.receipts")}</LinkButton></div></section>
  </ParentShell>;
}
