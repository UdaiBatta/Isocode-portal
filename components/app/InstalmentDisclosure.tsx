import { RiArrowDownSLine } from "@remixicon/react";
import { Money } from "./Money";
import { StatusChip } from "./StatusChip";
import { dateLabel, inr } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { InstalmentVM, Language } from "@/lib/types";

// Native <details>, not BoardUI Accordion: the Accordion's script put /dues over its 200 KB budget, and this needs none.
export function InstalmentDisclosure({ instalments, language, today }: { instalments: InstalmentVM[]; language: Language; today: string }) {
  return <details className="group">
    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-md text-body-medium outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring [&::-webkit-details-marker]:hidden">{t(language, "dues.seeAll")}<RiArrowDownSLine aria-hidden className="size-5 shrink-0 text-foreground-icon-secondary group-open:rotate-180" /></summary>
    <ol className="divide-y divide-separator-border">
      {instalments.map((item) => <li key={item.id} className="flex flex-col gap-2 py-4">
        <div className="flex items-start justify-between gap-4"><span className="text-headline-medium">{t(language, "dues.instalment", { n: item.seq })}</span><Money paise={item.amount} /></div>
        <div className="flex items-center justify-between gap-4"><span className="text-body-regular text-text-secondary">{dateLabel(item.dueDate, language, today)}</span><StatusChip language={language} status={item.partPaid ? "part_paid" : item.status} /></div>
        {item.paid > 0 ? <p className="text-body-regular text-text-secondary">{t(language, "dues.partPaid", { paid: inr(item.paid), total: inr(item.amount) })}</p> : null}
        {item.daysOverdue > 0 ? <p className="text-body-regular text-status-rose-text">{t(language, item.daysOverdue === 1 ? "dues.overdueOne" : "dues.overdue", { n: item.daysOverdue })}</p> : null}
      </li>)}
    </ol>
  </details>;
}
