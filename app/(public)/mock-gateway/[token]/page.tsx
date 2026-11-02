import { PageShell } from "@/components/app/PageShell";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";
import { Money } from "@/components/app/Money";
import { MockGateway } from "@/components/app/MockGateway";
import { getPayDetails } from "@/lib/data/payments";
import { getParentPageContext } from "@/lib/data/auth";
import { previewState, type SearchParams } from "@/lib/preview";
import { t } from "@/lib/i18n";

export default async function Gateway({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<SearchParams> }) {
  const { token } = await params;
  const { language } = await getParentPageContext();
  const state = previewState(await searchParams);
  if (state === "loading") return <PageSkeleton language={language} />;
  const view = state === "empty" ? null : await getPayDetails(token);
  if (!view) return <PageShell><EmptyState title={t(language, "pay.invalid")} /></PageShell>;
  return <PageShell className="flex flex-col gap-8">
    <div className="flex justify-end"><LanguageSwitcher language={language} /></div>
    <p role="note" className="rounded-xl bg-status-yellow-background px-4 py-3 text-body-medium text-status-yellow-text">{t(language, "pay.testMode")}</p>
    <h1 className="text-title-1-medium">{t(language, "pay.title", { name: view.firstName })}</h1>
    {view.paid ? <p className="text-headline-regular">{t(language, "pay.alreadyPaid")}</p> : <><Money paise={view.amount} prominent /><MockGateway token={token} language={language} /></>}
  </PageShell>;
}
