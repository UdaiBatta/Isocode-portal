import { redirect } from "next/navigation";
import { PageShell } from "@/components/app/PageShell";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { ParentShell, parentSectionClass } from "@/components/app/ParentShell";
import { StaffFrame } from "@/components/app/StaffPage";
import { LinkButton } from "@/components/base/buttons/link-button";
import { getReceipts } from "@/lib/data/receipts";
import { getFamily } from "@/lib/data/student";
import { getParentPageContext } from "@/lib/data/auth";
import { previewState, type SearchParams } from "@/lib/preview";
import { dateLabel, inr } from "@/lib/format";
import { t } from "@/lib/i18n";
import { pt } from "@/lib/i18n/portal";

export default async function Receipts({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const context = await getParentPageContext();
  const { language, today } = context;
  const state = previewState(query);
  if (state === "loading") return <PageSkeleton language={language} />;
  if (state === "empty") return <PageShell><EmptyState title={t(language, "receipts.empty")} /></PageShell>;
  if (context.role !== "parent") redirect("/login");
  if (!context.consent) redirect("/consent");
  const selected = typeof query.student === "string" ? query.student : undefined;
  const [family, rows] = await Promise.all([getFamily(selected), getReceipts(selected)]);
  return <ParentShell language={language} active="fees" path="/receipts" {...family} title={t(language, "receipts.title")} description={pt(language, "receipts.description")}><StaffFrame><section className={parentSectionClass}>
    {rows.length ? <ul className="divide-y divide-separator-border">{rows.map((receipt) => <li key={receipt.id}>
      <LinkButton href={`/receipts/${receipt.id}`} variant="secondary" className="flex w-full flex-col items-stretch gap-2 whitespace-normal py-4 text-start">
        <span className="flex justify-between gap-4 text-headline-medium"><span>{dateLabel(receipt.issuedOn, language, today)}</span><span className="tabular-nums text-text-primary">{inr(receipt.amount)}</span></span>
        <bdi className="text-body-regular">{receipt.number}</bdi>
      </LinkButton>
    </li>)}</ul> : <EmptyState title={t(language, "receipts.empty")} />}
    <div><LinkButton href={selected ? `/dues?student=${encodeURIComponent(selected)}` : "/dues"} variant="secondary">{t(language, "pay.backToDues")}</LinkButton></div>
  </section></StaffFrame></ParentShell>;
}
