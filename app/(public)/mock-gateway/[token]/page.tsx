import { RiLockLine } from "@remixicon/react";
import { PageShell } from "@/components/app/PageShell";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";
import { Money } from "@/components/app/Money";
import { MockGateway } from "@/components/app/MockGateway";
import { getPayDetails } from "@/lib/data/payments";
import { getParentPageContext } from "@/lib/data/auth";
import { ORG } from "@/lib/config";
import { dateLabel } from "@/lib/format";
import { previewState, type SearchParams } from "@/lib/preview";
import { t } from "@/lib/i18n";
import { ct } from "@/lib/i18n/checkout";

export default async function Gateway({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<SearchParams> }) {
  const { token } = await params;
  const { language, today } = await getParentPageContext();
  const state = previewState(await searchParams);
  if (state === "loading") return <PageSkeleton language={language} />;
  const view = state === "empty" ? null : await getPayDetails(token);
  if (!view) return <PageShell><EmptyState title={t(language, "pay.invalid")} /></PageShell>;
  return <PageShell className="flex flex-col gap-6">
    <div className="flex items-center justify-between gap-4">
      <p className="flex items-center gap-2 text-body-medium text-text-secondary"><RiLockLine size={16} aria-hidden="true" />{ct(language, "checkout.title")}</p>
      <LanguageSwitcher language={language} />
    </div>
    <p role="note" className="rounded-xl bg-status-yellow-background px-4 py-3 text-body-medium text-status-yellow-text">{t(language, "pay.testMode")}</p>
    <section className="flex flex-col gap-3 rounded-3xl border border-border-button-default p-5">
      <h1 className="text-title-3-semibold">{t(language, "pay.title", { name: view.firstName })}</h1>
      {view.paid ? <p className="text-headline-regular">{t(language, "pay.alreadyPaid")}</p> : <>
        <p className="text-body-regular text-text-secondary">{ct(language, "checkout.instalment", { n: view.seq })} · {ORG.name}, {ORG.city}</p>
        <Money paise={view.amount} prominent />
        <p className="text-body-regular">{t(language, view.dueDate === today ? "dues.dueToday" : view.dueDate < today ? "dues.wasDue" : "dues.due", { date: dateLabel(view.dueDate, language, today) })}</p>
      </>}
    </section>
    {view.paid ? null : <MockGateway token={token} language={language} amount={view.amount} />}
  </PageShell>;
}
