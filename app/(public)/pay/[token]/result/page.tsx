import { PageShell } from "@/components/app/PageShell";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";
import { Money } from "@/components/app/Money";
import { PaymentGraphic } from "@/components/app/PaymentGraphic";
import { ButtonLink } from "@/components/base/buttons/button";
import { getPaymentResult } from "@/lib/data/payments";
import { getParentPageContext } from "@/lib/data/auth";
import { ORG } from "@/lib/config";
import { dateLabel } from "@/lib/format";
import { previewState, type SearchParams } from "@/lib/preview";
import { t } from "@/lib/i18n";
import { ct, methodLabel } from "@/lib/i18n/checkout";

const outcomes = {
  paid: { graphic: "paid", title: "pay.success", help: null },
  already_paid: { graphic: "paid", title: "pay.alreadyPaid", help: null },
  failed: { graphic: "failed", title: "pay.failed", help: "pay.failedHelp" },
  checking: { graphic: "checking", title: "dues.review", help: "pay.checkingHelp" },
} as const;

export default async function PaymentResult({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<SearchParams> }) {
  const { token } = await params;
  const query = await searchParams;
  const { language, today } = await getParentPageContext();
  const state = previewState(query);
  if (state === "loading") return <PageSkeleton language={language} />;
  const view = state === "empty" ? null : await getPaymentResult(token, query.e);
  if (!view) return <PageShell><EmptyState title={t(language, "pay.pending")} /></PageShell>;
  const receiptPath = view.receiptId ? `/receipts/${view.receiptId}` : null;
  const receiptHref = receiptPath && (view.canViewReceipt ? receiptPath : `/login?next=${encodeURIComponent(receiptPath)}`);
  const outcome = outcomes[view.result];
  const details: [string, string | null | undefined][] = [
    [ct(language, "result.paidTo"), `${ORG.name}, ${ORG.city}`],
    [ct(language, "result.for"), ct(language, "checkout.instalmentFor", { n: view.seq, name: view.firstName })],
    [t(language, "receipt.method"), view.method && methodLabel(language, view.method)],
    [ct(language, "result.reference"), view.reference],
    [t(language, "receipt.date"), view.on && dateLabel(view.on, language, today)],
    [t(language, "receipt.number"), view.receiptNumber],
  ];
  return <PageShell className="flex flex-col gap-6">
    <div className="flex justify-end"><LanguageSwitcher language={language} /></div>
    <div className="flex flex-col items-center gap-2 text-center">
      <PaymentGraphic kind={outcome.graphic} />
      <h1 className="mt-2 text-title-1-medium text-balance">{t(language, outcome.title)}</h1>
      <Money paise={view.amount} prominent />
      {outcome.help ? <p className="text-body-regular text-balance text-text-secondary">{ct(language, outcome.help)}</p> : null}
    </div>
    <dl className="flex flex-col gap-2 rounded-2xl bg-background-secondary-default p-4">
      {details.filter(([, value]) => value).map(([label, value]) => <div key={label} className="flex justify-between gap-4 text-body-2-regular"><dt className="shrink-0 text-text-secondary">{label}</dt><dd className="text-end"><bdi>{value}</bdi></dd></div>)}
    </dl>
    <div className="flex flex-col gap-3">
      {receiptHref ? <ButtonLink href={receiptHref} className="w-full text-headline-medium">{t(language, "pay.viewReceipt")}</ButtonLink> : null}
      {view.result === "failed" ? <ButtonLink href={`/mock-gateway/${token}`} className="w-full text-headline-medium">{t(language, "common.retry")}</ButtonLink> : null}
      <ButtonLink href={view.parentCanAccess ? `/dues?student=${encodeURIComponent(token.slice(0, 8))}` : "/login"} variant="secondary" className="w-full">{t(language, "pay.backToDues")}</ButtonLink>
    </div>
    <p className="text-center text-body-2-regular text-text-secondary">{ct(language, "result.testNote")}</p>
  </PageShell>;
}
