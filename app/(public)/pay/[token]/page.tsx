import { PageShell } from "@/components/app/PageShell";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { Money } from "@/components/app/Money";
import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";
import { ORG } from "@/lib/config";
import { ButtonLink } from "@/components/base/buttons/button";
import { getPayDetails } from "@/lib/data/payments";
import { getParentPageContext } from "@/lib/data/auth";
import { previewState, type SearchParams } from "@/lib/preview";
import { inr, dateLabel } from "@/lib/format";
import { t } from "@/lib/i18n";

export default async function Pay({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<SearchParams> }) {
  const { token } = await params;
  const context = await getParentPageContext();
  const { language, today } = context;
  const state = previewState(await searchParams);
  if (state === "loading") return <PageSkeleton language={language} />;
  const view = state === "empty" ? null : await getPayDetails(token);
  if (!view) return <PageShell><EmptyState title={t(language, "pay.invalid")} /></PageShell>;
  return <PageShell className="flex flex-col gap-8">
    <div className="flex items-center justify-between gap-3"><p className="ledger-type text-title-2-medium">{ORG.name}</p><LanguageSwitcher language={language} /></div>
    <h1 className="text-title-1-medium">{t(language, "pay.title", { name: view.firstName })}</h1>
    {view.paid ? <p className="text-headline-regular">{t(language, "pay.alreadyPaid")}</p> : <>
      <Money paise={view.amount} prominent />
      <p className="text-headline-regular">{t(language, view.dueDate === today ? "dues.dueToday" : view.dueDate < today ? "dues.wasDue" : "dues.due", { date: dateLabel(view.dueDate, language, today) })}</p>
      <ButtonLink href={view.payUrl ?? `/mock-gateway/${token}`} className="w-full text-headline-medium">{t(language, "pay.button", { amount: inr(view.amount) })}</ButtonLink>
    </>}
  </PageShell>;
}
