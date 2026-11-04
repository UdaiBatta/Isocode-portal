import { RiCheckLine } from "@remixicon/react";
import { Money } from "./Money";
import { PaymentGraphic } from "./PaymentGraphic";
import { StatusChip } from "./StatusChip";
import { ButtonLink } from "@/components/base/buttons/button";
import { dateLabel, inr } from "@/lib/format";
import { t } from "@/lib/i18n";
import { pt } from "@/lib/i18n/portal";
import type { DuesVM, InstalmentVM, Language } from "@/lib/types";

export const feeTotals = (view: DuesVM) => {
  const total = view.instalments.reduce((sum, item) => sum + item.amount, 0);
  const paid = view.instalments.reduce((sum, item) => sum + item.paid, 0);
  return { total, paid, remaining: total - paid };
};

// Every instalment as a seal on a thread: filled once paid, half for part paid, a red ring when due.
function InstalmentSeals({ instalments, language, today }: { instalments: InstalmentVM[]; language: Language; today: string }) {
  if (instalments.length < 2) return null;
  return <ol aria-label={pt(language, "home.instalments")} className="ledger-seals">{instalments.map((item) => {
    const state = item.status === "paid" ? "paid" : item.partPaid ? "part" : item.status === "upcoming" ? "open" : "due";
    return <li key={item.id}>
      <span className="ledger-seal" data-state={state}>{state === "paid" ? <RiCheckLine aria-hidden className="size-4" /> : null}</span>
      <span className="text-body-2-regular tabular-nums text-text-secondary">{dateLabel(item.dueDate, language, today)}<span className="sr-only"> · {inr(item.amount)} · {t(language, state === "paid" ? "status.paid" : state === "part" ? "status.partPaid" : state === "open" ? "status.upcoming" : "status.overdue")}</span></span>
    </li>;
  })}</ol>;
}

// What is owed, when, and the one action: shared by the Home and Fee details pages so their payment states cannot drift apart.
export function DuesStatus({ view, language, today }: { view: DuesVM; language: Language; today: string }) {
  const current = view.current;
  if (view.mode === "pay" && current) return <section className="ledger-folio flex flex-col gap-6">
    <div className="flex flex-col gap-2"><Money paise={current.balance} prominent />
      <p className="text-headline-regular">{t(language, current.status === "due_today" ? "dues.dueToday" : current.status === "overdue" ? "dues.wasDue" : "dues.due", { date: dateLabel(current.dueDate, language, today) })}</p>
      {current.daysOverdue > 0 ? <p className="ledger-stamp mt-2 md:absolute md:end-8 md:top-8 md:mt-0">{t(language, current.daysOverdue === 1 ? "dues.overdueOne" : "dues.overdue", { n: current.daysOverdue })}</p> : null}
    </div>
    {current.payUrl ? <ButtonLink href={current.payUrl} className="w-full text-headline-medium">{t(language, "dues.pay", { amount: inr(current.balance) })}</ButtonLink> : null}
    {current.partPaid ? <p className="text-body-regular text-text-secondary">{t(language, "dues.partPaid", { paid: inr(current.paid), total: inr(current.amount) })}</p> : null}
    <InstalmentSeals instalments={view.instalments} language={language} today={today} />
    {view.moreUnpaid > 0 ? <p className="text-body-regular text-text-secondary">{t(language, view.moreUnpaid === 1 ? "dues.moreOne" : "dues.more", { n: view.moreUnpaid })}</p> : null}
  </section>;
  if (view.mode === "clear") return <section className="ledger-folio flex flex-col gap-4"><h2 className="text-title-1-medium">{t(language, "dues.clear")}</h2>{view.next ? <p className="text-headline-regular text-text-secondary">{t(language, "dues.next", { amount: inr(view.next.amount), date: dateLabel(view.next.dueDate, language, today) })}</p> : null}</section>;
  if (view.mode === "review") return <section className="ledger-folio flex flex-col gap-4"><PaymentGraphic kind="checking" /><h2 className="text-title-2-medium">{t(language, "dues.review")}</h2></section>;
  if (view.refund) return <section className="ledger-folio flex flex-col gap-4">{view.refund.status === "paid" ? <PaymentGraphic kind="paid" /> : null}<h2 className="text-title-1-medium">{t(language, "refund.title")}</h2><Money paise={view.refund.amount} prominent /><div><StatusChip status={view.refund.status} language={language} /></div><p className="text-headline-regular">{t(language, "refund.payBy", { date: dateLabel(view.refund.deadline, language, today) })}</p>{view.refund.stillPayable > 0 ? <p className="text-body-regular">{t(language, "refund.stillPayable", { amount: inr(view.refund.stillPayable) })}</p> : null}</section>;
  return null;
}
