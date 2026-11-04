import { Money } from "./Money";
import { PaymentGraphic } from "./PaymentGraphic";
import { StatusChip } from "./StatusChip";
import { ButtonLink } from "@/components/base/buttons/button";
import { parentSectionClass } from "./ParentShell";
import { dateLabel, inr } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { DuesVM, Language } from "@/lib/types";

export const feeTotals = (view: DuesVM) => {
  const total = view.instalments.reduce((sum, item) => sum + item.amount, 0);
  const paid = view.instalments.reduce((sum, item) => sum + item.paid, 0);
  return { total, paid, remaining: total - paid };
};

// What is owed, when, and the one action: shared by the Home and Fee details pages so their payment states cannot drift apart.
export function DuesStatus({ view, language, today }: { view: DuesVM; language: Language; today: string }) {
  const current = view.current;
  if (view.mode === "pay" && current) return <section className={`${parentSectionClass} gap-6`}>
    <div className="flex flex-col gap-2"><Money paise={current.balance} prominent />
      <p className="text-headline-regular">{t(language, current.status === "due_today" ? "dues.dueToday" : current.status === "overdue" ? "dues.wasDue" : "dues.due", { date: dateLabel(current.dueDate, language, today) })}</p>
      {current.daysOverdue > 0 ? <p className="text-body-medium text-status-rose-text">{t(language, current.daysOverdue === 1 ? "dues.overdueOne" : "dues.overdue", { n: current.daysOverdue })}</p> : null}
    </div>
    {current.payUrl ? <ButtonLink href={current.payUrl} className="w-full text-headline-medium">{t(language, "dues.pay", { amount: inr(current.balance) })}</ButtonLink> : null}
    {current.partPaid ? <div className="flex flex-col gap-2"><p className="text-body-regular text-text-secondary">{t(language, "dues.partPaid", { paid: inr(current.paid), total: inr(current.amount) })}</p><span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-border-button-default"><span className="block h-full rounded-full bg-accent-700" style={{ width: `${current.paid / current.amount * 100}%` }} /></span></div> : null}
    {view.moreUnpaid > 0 ? <p className="text-body-regular text-text-secondary">{t(language, view.moreUnpaid === 1 ? "dues.moreOne" : "dues.more", { n: view.moreUnpaid })}</p> : null}
  </section>;
  if (view.mode === "clear") return <section className={parentSectionClass}><h2 className="text-title-1-medium">{t(language, "dues.clear")}</h2>{view.next ? <p className="text-headline-regular text-text-secondary">{t(language, "dues.next", { amount: inr(view.next.amount), date: dateLabel(view.next.dueDate, language, today) })}</p> : null}</section>;
  if (view.mode === "review") return <section className={parentSectionClass}><PaymentGraphic kind="checking" /><h2 className="text-title-2-medium">{t(language, "dues.review")}</h2></section>;
  if (view.refund) return <section className={parentSectionClass}>{view.refund.status === "paid" ? <PaymentGraphic kind="paid" /> : null}<h2 className="text-title-1-medium">{t(language, "refund.title")}</h2><Money paise={view.refund.amount} prominent /><div><StatusChip status={view.refund.status} language={language} /></div><p className="text-headline-regular">{t(language, "refund.payBy", { date: dateLabel(view.refund.deadline, language, today) })}</p>{view.refund.stillPayable > 0 ? <p className="text-body-regular">{t(language, "refund.stillPayable", { amount: inr(view.refund.stillPayable) })}</p> : null}</section>;
  return null;
}
