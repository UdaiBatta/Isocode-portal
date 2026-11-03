import { redirect } from "next/navigation";
import { PageShell } from "@/components/app/PageShell";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";
import { ChildSwitcher } from "@/components/app/ChildSwitcher";
import { InstalmentDisclosure } from "@/components/app/InstalmentDisclosure";
import { Money } from "@/components/app/Money";
import { StatusChip } from "@/components/app/StatusChip";
import { LogoutButton } from "@/components/app/LogoutButton";
import { ButtonLink } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { getDues } from "@/lib/data/dues";
import { getParentPageContext } from "@/lib/data/auth";
import { previewState, type SearchParams } from "@/lib/preview";
import { t } from "@/lib/i18n";
import { pt } from "@/lib/i18n/progress";
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
  const name = view.children.find((student) => student.studentId === view.selectedStudentId)?.fullName;
  const current = view.current;
  return <PageShell className="flex min-h-dvh flex-col gap-8 pt-6">
    <header className="flex items-center justify-between gap-2"><h1 className="min-w-0 text-headline-medium">{name}</h1><LanguageSwitcher language={language} /></header>
    {view.children.length > 1 ? <ChildSwitcher students={view.children} selected={view.selectedStudentId} language={language} /> : null}
    {view.mode === "pay" && current ? <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2"><Money paise={current.balance} prominent />
        <p className="text-headline-regular">{t(language, current.status === "due_today" ? "dues.dueToday" : current.status === "overdue" ? "dues.wasDue" : "dues.due", { date: dateLabel(current.dueDate, language, today) })}</p>
        {current.daysOverdue > 0 ? <p className="text-body-medium text-status-rose-text">{t(language, current.daysOverdue === 1 ? "dues.overdueOne" : "dues.overdue", { n: current.daysOverdue })}</p> : null}
      </div>
      {current.payUrl ? <ButtonLink href={current.payUrl} className="w-full text-headline-medium">{t(language, "dues.pay", { amount: inr(current.balance) })}</ButtonLink> : null}
      {current.partPaid ? <p className="text-body-regular text-text-secondary">{t(language, "dues.partPaid", { paid: inr(current.paid), total: inr(current.amount) })}</p> : null}
      {view.moreUnpaid > 0 ? <p className="text-body-regular text-text-secondary">{t(language, view.moreUnpaid === 1 ? "dues.moreOne" : "dues.more", { n: view.moreUnpaid })}</p> : null}
    </section> : view.mode === "clear" ? <section className="flex flex-col gap-4"><h2 className="text-title-1-medium">{t(language, "dues.clear")}</h2>{view.next ? <p className="text-headline-regular text-text-secondary">{t(language, "dues.next", { amount: inr(view.next.amount), date: dateLabel(view.next.dueDate, language, today) })}</p> : null}</section>
    : view.mode === "review" ? <section><h2 className="text-title-2-medium">{t(language, "dues.review")}</h2></section>
    : view.refund ? <section className="flex flex-col gap-4"><h2 className="text-title-1-medium">{t(language, "refund.title")}</h2><Money paise={view.refund.amount} prominent /><div><StatusChip status={view.refund.status} language={language} /></div><p className="text-headline-regular">{t(language, "refund.payBy", { date: dateLabel(view.refund.deadline, language, today) })}</p>{view.refund.stillPayable > 0 ? <p className="text-body-regular">{t(language, "refund.stillPayable", { amount: inr(view.refund.stillPayable) })}</p> : null}</section> : null}
    {view.mode !== "withdrawn" ? <InstalmentDisclosure instalments={view.instalments} language={language} today={today} /> : null}
    <footer className="flex flex-wrap items-center gap-6"><LinkButton href={`/receipts?student=${view.selectedStudentId}`} variant="secondary">{t(language, "dues.receipts")}</LinkButton><LinkButton href={`/progress?student=${view.selectedStudentId}`} variant="secondary">{pt(language, "progress.link")}</LinkButton><LogoutButton language={language} /></footer>
  </PageShell>;
}
