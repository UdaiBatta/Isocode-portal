import { redirect } from "next/navigation";
import { PageShell } from "@/components/app/PageShell";
import { ParentShell } from "@/components/app/ParentShell";
import { getFamily } from "@/lib/data/student";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";
import { Money } from "@/components/app/Money";
import { PrintReceipt } from "@/components/app/PrintReceipt";
import { ReceiptTaxTable } from "@/components/app/ReceiptTaxTable";
import { LinkButton } from "@/components/base/buttons/link-button";
import { getReceipt, getReceiptOrganisation } from "@/lib/data/receipts";
import { getParentPageContext } from "@/lib/data/auth";
import { previewState, type SearchParams } from "@/lib/preview";
import { dateLabel } from "@/lib/format";
import { methodLabel } from "@/lib/i18n/checkout";
import { t, type TranslationKey } from "@/lib/i18n";

export default async function Receipt({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  const context = await getParentPageContext();
  const { language, today } = context;
  const state = previewState(await searchParams);
  if (state === "loading") return <PageSkeleton language={language} />;
  if (state === "empty") return <PageShell><EmptyState title={t(language, "receipts.empty")} /></PageShell>;
  if (context.role !== "parent" && context.role !== "accounts") redirect(`/login?next=${encodeURIComponent(`/receipts/${id}`)}`);
  if (context.role === "parent" && !context.consent) redirect(`/consent?next=${encodeURIComponent(`/receipts/${id}`)}`);
  const receipt = await getReceipt(id);
  const organisation = await getReceiptOrganisation();
  const fields: [TranslationKey, string][] = [["receipt.number", receipt.number], ["receipt.date", dateLabel(receipt.issuedOn, language, today)], ["receipt.student", `${receipt.student.name} · ${receipt.student.code}`], ["receipt.batch", receipt.student.batch], ["receipt.centre", receipt.student.centre], ["receipt.method", methodLabel(language, receipt.method)]];
  const body = <div className="ledger-slip">
    <span className="ledger-stamp ledger-stamp-paid ledger-stamp-large ledger-slip-stamp">{t(language, "status.paid")}</span>
    <header className="flex flex-col gap-2 pe-28"><p className="text-headline-medium">{organisation.name} · {organisation.city}</p><h1 className="text-title-1-medium">{t(language, "receipt.title")}</h1><p className="text-body-regular text-text-secondary">{t(language, "receipt.gstin")}: <bdi>{organisation.gstin.replace(" (sample)", "")}</bdi> {t(language, "receipt.sample")}</p></header>
    <dl className="flex flex-col gap-4">{fields.map(([key, value]) => <div key={key} className="grid grid-cols-[100px_minmax(0,1fr)] gap-4"><dt className="text-body-regular text-text-secondary">{t(language, key)}</dt><dd className="break-words text-body-medium"><bdi>{value}</bdi></dd></div>)}</dl>
    <ReceiptTaxTable amounts={receipt} language={language} />
    <div className="flex items-baseline justify-between gap-4"><span className="text-headline-medium">{t(language, "receipt.total")}</span><Money paise={receipt.amount} prominent /></div>
    <PrintReceipt language={language} />
    <footer className="flex flex-col items-start gap-2 print:hidden"><LinkButton href={context.role === "parent" ? `/dues?student=${receipt.student.code}` : "/staff/login"} variant="secondary">{t(language, "pay.backToDues")}</LinkButton><LinkButton href="/refund-policy" variant="secondary">{t(language, "policy.title")}</LinkButton></footer>
  </div>;
  if (context.role === "parent") return <ParentShell language={language} active="receipts" {...await getFamily(receipt.student.code)}>{body}</ParentShell>;
  return <PageShell className="flex flex-col gap-8"><div className="flex justify-end print:hidden"><LanguageSwitcher language={language} /></div>{body}</PageShell>;
}
