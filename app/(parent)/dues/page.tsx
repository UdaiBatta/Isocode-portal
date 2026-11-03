import { redirect } from "next/navigation";
import { PageShell } from "@/components/app/PageShell";
import { ParentDetails, ParentShell, parentSectionClass } from "@/components/app/ParentShell";
import { StaffFrame } from "@/components/app/StaffPage";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { InstalmentDisclosure } from "@/components/app/InstalmentDisclosure";
import { Money } from "@/components/app/Money";
import { StatusChip } from "@/components/app/StatusChip";
import { ButtonLink } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { getDues } from "@/lib/data/dues";
import { getParentPageContext } from "@/lib/data/auth";
import { previewState, type SearchParams } from "@/lib/preview";
import { t } from "@/lib/i18n";
import { pt } from "@/lib/i18n/portal";
import { dateLabel, inr } from "@/lib/format";

export default async function Dues({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const context = await getParentPageContext();
  const { language, today } = context;
  const state = previewState(params);
  if (state === "loading") return <PageSkeleton language={language} />;
  if (state === "empty") return <PageShell><EmptyState title={t(language, "dues.clear")} /></PageShell>;
  if (context.role === "parent" && !context.consent) redirect("/consent");
  if (context.role && context.role !== "parent") redirect("/staff/login");
  const view = await getDues(typeof params.student === "string" ? params.student : undefined);
  const current = view.current;
  const total = view.instalments.reduce((sum, item) => sum + item.amount, 0);
  const paid = view.instalments.reduce((sum, item) => sum + item.paid, 0);
  return <ParentShell language={language} active="fees" family={view.children} selected={view.selectedStudentId} title={pt(language, "portal.fees")} description={pt(language, "fees.description")}><StaffFrame>
    {view.mode === "pay" && current ? <section className={`${parentSectionClass} gap-6`}>
      <div className="flex flex-col gap-2"><Money paise={current.balance} prominent />
        <p className="text-headline-regular">{t(language, current.status === "due_today" ? "dues.dueToday" : current.status === "overdue" ? "dues.wasDue" : "dues.due", { date: dateLabel(current.dueDate, language, today) })}</p>
        {current.daysOverdue > 0 ? <p className="text-body-medium text-status-rose-text">{t(language, current.daysOverdue === 1 ? "dues.overdueOne" : "dues.overdue", { n: current.daysOverdue })}</p> : null}
      </div>
      {current.payUrl ? <ButtonLink href={current.payUrl} className="w-full text-headline-medium">{t(language, "dues.pay", { amount: inr(current.balance) })}</ButtonLink> : null}
      {current.partPaid ? <p className="text-body-regular text-text-secondary">{t(language, "dues.partPaid", { paid: inr(current.paid), total: inr(current.amount) })}</p> : null}
      {view.moreUnpaid > 0 ? <p className="text-body-regular text-text-secondary">{t(language, view.moreUnpaid === 1 ? "dues.moreOne" : "dues.more", { n: view.moreUnpaid })}</p> : null}
    </section> : view.mode === "clear" ? <section className={parentSectionClass}><h2 className="text-title-1-medium">{t(language, "dues.clear")}</h2>{view.next ? <p className="text-headline-regular text-text-secondary">{t(language, "dues.next", { amount: inr(view.next.amount), date: dateLabel(view.next.dueDate, language, today) })}</p> : null}</section>
    : view.mode === "review" ? <section className={parentSectionClass}><h2 className="text-title-2-medium">{t(language, "dues.review")}</h2></section>
    : view.refund ? <section className={parentSectionClass}><h2 className="text-title-1-medium">{t(language, "refund.title")}</h2><Money paise={view.refund.amount} prominent /><div><StatusChip status={view.refund.status} language={language} /></div><p className="text-headline-regular">{t(language, "refund.payBy", { date: dateLabel(view.refund.deadline, language, today) })}</p>{view.refund.stillPayable > 0 ? <p className="text-body-regular">{t(language, "refund.stillPayable", { amount: inr(view.refund.stillPayable) })}</p> : null}</section> : null}
    {view.mode !== "withdrawn" ? <section className={parentSectionClass}>
      <h2 className="text-headline-medium">{pt(language, "fees.summary")}</h2>
      <ParentDetails rows={[[pt(language, "fees.total"), inr(total)], [pt(language, "fees.paid"), inr(paid)], [pt(language, "fees.remaining"), inr(total - paid)]]} />
      <InstalmentDisclosure instalments={view.instalments} language={language} today={today} />
    </section> : null}
    <section className={parentSectionClass}><div><LinkButton href={`/receipts?student=${view.selectedStudentId}`} variant="secondary">{t(language, "dues.receipts")}</LinkButton></div></section>
  </StaffFrame></ParentShell>;
}
