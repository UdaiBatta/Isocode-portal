import { EmptyState } from "@/components/app/EmptyState";
import { InvoiceTable } from "@/components/app/InvoiceTable";
import { ParentShell, parentSectionClass } from "@/components/app/ParentShell";
import { parentPage } from "@/lib/data/parent-page";
import { getInvoices } from "@/lib/data/receipts";
import { dateLabel, inr } from "@/lib/format";
import { t } from "@/lib/i18n";
import { methodLabel } from "@/lib/i18n/checkout";
import { pt } from "@/lib/i18n/portal";
import type { SearchParams } from "@/lib/preview";

export default async function Receipts({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { language, today, student, state, shell } = await parentPage(await searchParams);
  const header = { active: "receipts", title: t(language, "receipts.title"), description: pt(language, "receipts.description"), emptyTitle: t(language, "receipts.empty") } as const;
  if (state) return <ParentShell {...shell} {...header} />;
  const rows = (await getInvoices(student)).map(({ issuedOn, amount, method, ...row }) => ({ ...row, date: dateLabel(issuedOn, language, today), amount: inr(amount), description: method ? pt(language, "invoice.feePayment", { method: methodLabel(language, method) }) : pt(language, "invoice.checking") }));
  const labels = { date: pt(language, "invoice.date"), description: pt(language, "invoice.description"), amount: pt(language, "invoice.amount"), status: pt(language, "invoice.status"), action: pt(language, "invoice.action"), paid: pt(language, "invoice.paid"), pending: pt(language, "invoice.pending"), download: pt(language, "invoice.download"), label: t(language, "receipts.title") };
  return <ParentShell {...shell} {...header}>
    <section className={parentSectionClass}>{rows.length ? <InvoiceTable rows={rows} labels={labels} /> : <EmptyState title={t(language, "receipts.empty")} />}</section>
  </ParentShell>;
}
