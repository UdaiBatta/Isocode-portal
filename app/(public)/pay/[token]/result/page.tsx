import { PageShell } from "@/components/app/PageShell";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";
import { Money } from "@/components/app/Money";
import { ButtonLink } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { getPaymentResult } from "@/lib/data/payments";
import { getParentPageContext } from "@/lib/data/auth";
import { previewState, type SearchParams } from "@/lib/preview";
import { t } from "@/lib/i18n";

export default async function PaymentResult({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<SearchParams> }) {
  const { token } = await params;
  const query = await searchParams;
  const { language } = await getParentPageContext();
  const state = previewState(query);
  if (state === "loading") return <PageSkeleton language={language} />;
  const view = state === "empty" ? null : await getPaymentResult(token, query.e);
  if (!view) return <PageShell><EmptyState title={t(language, "pay.pending")} /></PageShell>;
  const receiptPath = view.receiptId ? `/receipts/${view.receiptId}` : null;
  const receiptHref = receiptPath && (view.canViewReceipt ? receiptPath : `/login?next=${encodeURIComponent(receiptPath)}`);
  return <PageShell className="flex flex-col gap-8">
    <div className="flex justify-end"><LanguageSwitcher language={language} /></div>
    {view.result === "paid" ? <svg className="payment-tick text-status-lime-text" width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M7 16L13 22L26 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
    <h1 className="text-title-1-medium">{t(language, view.result === "paid" ? "pay.success" : view.result === "failed" ? "pay.failed" : view.result === "checking" ? "dues.review" : "pay.alreadyPaid")}</h1>
    <Money paise={view.amount} prominent />
    {view.receiptNumber ? <p className="text-body-regular text-text-secondary">{t(language, "receipt.number")} <bdi>{view.receiptNumber}</bdi></p> : null}
    {receiptHref ? <ButtonLink href={receiptHref} className="w-full text-headline-medium">{t(language, "pay.viewReceipt")}</ButtonLink> : null}
    {view.result === "failed" ? <ButtonLink href={`/mock-gateway/${token}`} className="w-full text-headline-medium">{t(language, "common.retry")}</ButtonLink> : null}
    <LinkButton href={view.parentCanAccess ? `/dues?student=${encodeURIComponent(token.slice(0, 8))}` : "/login"} variant="secondary">{t(language, "pay.backToDues")}</LinkButton>
  </PageShell>;
}
