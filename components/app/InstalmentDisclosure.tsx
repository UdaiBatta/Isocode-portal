"use client";

import { Accordion, AccordionItem } from "@/components/base/accordion/accordion";
import { Money } from "./Money";
import { StatusChip } from "./StatusChip";
import { dateLabel, inr } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { InstalmentVM, Language } from "@/lib/types";

export function InstalmentDisclosure({ instalments, language, today }: { instalments: InstalmentVM[]; language: Language; today: string }) {
  return <Accordion><AccordionItem id="instalments" title={<span className="text-body-medium">{t(language, "dues.seeAll")}</span>} headingLevel={2}>
    <ol className="divide-y divide-separator-border">
      {instalments.map((item) => <li key={item.id} className="flex flex-col gap-2 py-4">
        <div className="flex items-start justify-between gap-4"><span className="text-headline-medium">{t(language, "dues.instalment", { n: item.seq })}</span><Money paise={item.amount} /></div>
        <div className="flex items-center justify-between gap-4"><span className="text-body-regular text-text-secondary">{dateLabel(item.dueDate, language, today)}</span><StatusChip language={language} status={item.partPaid ? "part_paid" : item.status} /></div>
        {item.paid > 0 ? <p className="text-body-regular text-text-secondary">{t(language, "dues.partPaid", { paid: inr(item.paid), total: inr(item.amount) })}</p> : null}
        {item.daysOverdue > 0 ? <p className="text-body-regular text-status-rose-text">{t(language, item.daysOverdue === 1 ? "dues.overdueOne" : "dues.overdue", { n: item.daysOverdue })}</p> : null}
      </li>)}
    </ol>
  </AccordionItem></Accordion>;
}
